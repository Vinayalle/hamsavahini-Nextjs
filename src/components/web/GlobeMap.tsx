"use client";

import { useEffect, useRef, useState } from "react";
import type { GlobeInstance } from "globe.gl";

/**
 * The 3D globe on the Global operations page. It turns slowly, can be dragged, shows a pin for every location the admin has added
 * (at the latitude and longitude of the location, or at its country when none was entered), lets the visitor click a pin, and flies to
 * the location that is selected from the list. Pictures and country borders are files of this site (public/globe), so nothing is loaded
 * from another address. globe.gl (three.js) is loaded here, on demand, so the rest of the site does not pay for it.
 */
export interface GlobePin { id: string; name: string; place: string; kind: string; color: string; country: string; lat: number | null; lng: number | null }
type Placed = GlobePin & { lat: number; lng: number };

type Feature = { properties: Record<string, string>; geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] } };

/** Other spellings an admin may type for a country, mapped to the name used in the borders file. */
const ALIAS: Record<string, string> = { usa: "united states of america", "united states": "united states of america", us: "united states of america", uk: "united kingdom", uae: "united arab emirates", drc: "dem. rep. congo" };

/** The middle of a country's biggest piece of land: a good enough place for a pin when no coordinates were entered. */
function countryCentre(features: Feature[], country: string): { lat: number; lng: number } | null {
  const wanted = country.trim().toLowerCase();
  const name = ALIAS[wanted] ?? wanted;
  const f = features.find((x) => [x.properties.NAME, x.properties.NAME_LONG, x.properties.ADMIN, x.properties.FORMAL_EN].some((n) => n?.toLowerCase() === name));
  if (!f) return null;
  const rings = f.geometry.type === "Polygon" ? [f.geometry.coordinates as number[][][]] : (f.geometry.coordinates as number[][][][]);
  let best: number[][] | null = null;
  for (const poly of rings) if (!best || poly[0].length > best.length) best = poly[0];
  if (!best) return null;
  const lngs = best.map((p) => p[0]); const lats = best.map((p) => p[1]);
  return { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lng: (Math.min(...lngs) + Math.max(...lngs)) / 2 };
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function GlobeMap({ pins, label, selectedId = null, onSelect }: { pins: GlobePin[]; label: string; selectedId?: string | null; onSelect?: (id: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const globe = useRef<GlobeInstance | null>(null);
  const features = useRef<Feature[]>([]);
  const placed = useRef<Placed[]>([]);
  const selected = useRef<string | null>(selectedId);
  const pick = useRef(onSelect);
  const [state, setState] = useState<"loading" | "ready" | "unsupported">("loading");
  const pinsKey = JSON.stringify(pins);

  useEffect(() => { pick.current = onSelect; }, [onSelect]);

  // Build the globe once.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let stop = () => {};
    let cancelled = false;
    (async () => {
      try {
        const [{ default: Globe }, countries] = await Promise.all([import("globe.gl"), fetch("/globe/countries.geojson").then((r) => r.json() as Promise<{ features: Feature[] }>)]);
        if (cancelled) return;
        features.current = countries.features;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const g = new Globe(el, { animateIn: !reduced })
          .backgroundColor("rgba(0,0,0,0)")
          .globeImageUrl("/globe/earth-blue-marble.jpg")
          .bumpImageUrl("/globe/earth-topology.png")
          .atmosphereColor("#3b82f6")
          .atmosphereAltitude(0.22)
          .polygonsData(countries.features)
          .polygonCapColor(() => "rgba(0,0,0,0)")
          .polygonSideColor(() => "rgba(0,0,0,0)")
          .polygonStrokeColor(() => "rgba(96,165,250,0.85)")
          .polygonAltitude(0.004)
          .pointLat("lat").pointLng("lng")
          .pointColor("color")
          .pointLabel((d: object) => { const p = d as GlobePin; return `<div style="font:600 13px system-ui;padding:8px 10px;border-radius:10px;background:rgba(15,23,42,.95);color:#fff;border:1px solid ${p.color}"><div>${escapeHtml(p.name)}</div><div style="font-weight:400;opacity:.75">${escapeHtml(p.kind)} · ${escapeHtml(p.place)}</div></div>`; })
          .onPointClick((d: object) => pick.current?.((d as GlobePin).id))
          .onPointHover((d: object | null) => { el.style.cursor = d ? "pointer" : ""; })
          .ringLat("lat").ringLng("lng")
          .ringColor((d: object) => { const c = (d as GlobePin).color; return (t: number) => `${c}${Math.round((1 - t) * 255).toString(16).padStart(2, "0")}`; })
          .ringMaxRadius(3.2).ringPropagationSpeed(1.6).ringRepeatPeriod(1800);
        const size = () => g.width(el.clientWidth).height(el.clientHeight);
        size();
        const ro = new ResizeObserver(size); ro.observe(el);
        const controls = g.controls();
        controls.enableZoom = false; // the wheel keeps scrolling the page
        controls.autoRotate = !reduced;
        controls.autoRotateSpeed = 0.55;
        g.pointOfView({ lat: 20, lng: 78, altitude: 2.1 }, 0);
        const io = new IntersectionObserver(([e]) => (e.isIntersecting ? g.resumeAnimation() : g.pauseAnimation()));
        io.observe(el);
        globe.current = g;
        stop = () => { ro.disconnect(); io.disconnect(); g.pauseAnimation(); g._destructor?.(); el.replaceChildren(); globe.current = null; };
        setState("ready");
      } catch {
        if (!cancelled) setState("unsupported");
      }
    })();
    return () => { cancelled = true; stop(); };
  }, []);

  // Put the pins (all of them, or only the ones the visitor filtered to) on the globe.
  useEffect(() => {
    const g = globe.current;
    if (state !== "ready" || !g) return;
    placed.current = (JSON.parse(pinsKey) as GlobePin[]).flatMap((p) => {
      const at = p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : countryCentre(features.current, p.country);
      return at ? [{ ...p, ...at }] : [];
    });
    g.pointsData(placed.current).ringsData(placed.current);
  }, [pinsKey, state]);

  // The selected location is bigger, and the globe turns to face it.
  useEffect(() => {
    const g = globe.current;
    selected.current = selectedId;
    if (state !== "ready" || !g) return;
    const on = (d: object) => (d as GlobePin).id === selected.current;
    g.pointRadius((d: object) => (on(d) ? 0.9 : 0.5)).pointAltitude((d: object) => (on(d) ? 0.08 : 0.03));
    const controls = g.controls();
    const target = placed.current.find((p) => p.id === selectedId);
    if (target) {
      controls.autoRotate = false;
      g.pointOfView({ lat: target.lat, lng: target.lng, altitude: 1.5 }, 1000);
    } else if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      controls.autoRotate = true;
    }
  }, [selectedId, state, pinsKey]);

  return (
    <div role="img" aria-label={label} className="relative mx-auto aspect-square w-full max-w-[640px] cursor-grab touch-pan-y active:cursor-grabbing">
      <div ref={box} className="absolute inset-0" />
      {state === "loading" && <p className="absolute inset-0 flex items-center justify-center text-sm text-white/60">Loading the globe…</p>}
      {state === "unsupported" && <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/70">The globe could not be shown on this device. The list of locations is below.</p>}
    </div>
  );
}
