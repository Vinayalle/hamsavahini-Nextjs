"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { LuBuilding2, LuFactory, LuGlobe, LuMapPin, LuPickaxe, LuShip, LuX } from "react-icons/lu";
import type { IconType } from "react-icons";
import { GlobeMap, type GlobePin } from "./GlobeMap";

/**
 * The interactive part of the Global operations page: filter tabs, the globe, a detail panel for the selected place, and a grid of every
 * location. Clicking a pin on the globe or a card in the grid selects it; the globe turns to face it and the panel shows its details.
 */
export interface OperationsLocation {
  id: string; name: string; type: string; typeKey: string; country: string; city: string; description: string; operations: string | null; capacity: string | null;
  latitude: number | null; longitude: number | null; color: string; abroad: boolean;
}

const FILTERS: { key: string; label: string; icon: IconType; test: (l: OperationsLocation) => boolean }[] = [
  { key: "all", label: "All", icon: LuGlobe, test: () => true },
  { key: "mines", label: "Mines", icon: LuPickaxe, test: (l) => l.typeKey === "mine" },
  { key: "processing", label: "Processing", icon: LuFactory, test: (l) => l.typeKey === "processing_facility" },
  { key: "logistics", label: "Ports & warehouses", icon: LuShip, test: (l) => l.typeKey === "port_terminal" || l.typeKey === "warehouse" },
  { key: "offices", label: "Offices", icon: LuBuilding2, test: (l) => ["headquarters", "regional_office", "representative"].includes(l.typeKey) },
  { key: "international", label: "International", icon: LuMapPin, test: (l) => l.abroad },
];

export function OperationsExplorer({ locations, legend }: { locations: OperationsLocation[]; legend: { label: string; color: string }[] }) {
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const globeCard = useRef<HTMLDivElement>(null);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, locations.filter(f.test).length])), [locations]);
  const shown = useMemo(() => locations.filter((FILTERS.find((f) => f.key === filter) ?? FILTERS[0]).test), [locations, filter]);
  const pins: GlobePin[] = useMemo(() => shown.map((l) => ({ id: l.id, name: l.name, place: [l.city, l.country].filter(Boolean).join(", "), kind: l.type, color: l.color, country: l.country, lat: l.latitude, lng: l.longitude })), [shown]);
  const selected = shown.find((l) => l.id === selectedId) ?? null;

  const choose = (id: string | null, scroll = false) => {
    setSelectedId(id);
    if (id && scroll) globeCard.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div>
      {/* Filter tabs */}
      <div role="tablist" aria-label="Filter locations" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 sm:flex-wrap sm:justify-center sm:overflow-visible">
        {FILTERS.filter((f) => f.key === "all" || counts[f.key] > 0).map((f) => {
          const on = filter === f.key;
          return (
            <button key={f.key} type="button" role="tab" aria-selected={on} onClick={() => { setFilter(f.key); setSelectedId(null); }}
              className={`inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition ${on ? "border-gold-400 bg-gold-500 text-ink shadow-lg shadow-gold-500/25" : "border-white/15 bg-white/5 text-white/80 hover:border-gold-400/60 hover:bg-white/10"}`}>
              <f.icon className="size-4" aria-hidden />{f.label}
              <span className={`rounded-full px-2 py-0.5 text-xs ${on ? "bg-ink/15" : "bg-white/10"}`}>{counts[f.key]}</span>
            </button>
          );
        })}
      </div>

      {/* Globe and details */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_1fr] lg:items-stretch">
        <div ref={globeCard} className="relative overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(135deg,#0f172a,#1e293b,#0f172a)] p-3 shadow-2xl shadow-black/40 sm:p-6">
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-blue-500/20 blur-3xl" />
          <GlobeMap pins={pins} label={`Globe showing ${pins.length} locations`} selectedId={selected?.id ?? null} onSelect={(id) => choose(id)} />
          <ul className="mt-3 flex flex-wrap justify-center gap-2.5">
            {legend.map((x) => (
              <li key={x.label} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80">
                <span aria-hidden className="relative flex size-3"><span className="absolute inset-0 animate-ping rounded-full opacity-70" style={{ background: x.color }} /><span className="relative size-3 rounded-full border-2 border-white" style={{ background: x.color }} /></span>
                {x.label}
              </li>
            ))}
          </ul>
        </div>

        <aside aria-live="polite" className="flex flex-col rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30 backdrop-blur sm:p-8">
          {selected ? (
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-4">
                <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider" style={{ borderColor: selected.color, color: selected.color }}>
                  <span aria-hidden className="size-2 rounded-full" style={{ background: selected.color }} />{selected.type}
                </span>
                <button type="button" onClick={() => choose(null)} aria-label="Close details" className="cursor-pointer rounded-full border border-white/15 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"><LuX className="size-4" aria-hidden /></button>
              </div>
              <h3 className="mt-5 text-2xl font-bold leading-tight text-white md:text-3xl">{selected.name}</h3>
              <p className="mt-2 flex items-center gap-2 text-white/70"><LuMapPin className="size-4 shrink-0 text-gold-300" aria-hidden />{[selected.city, selected.country].filter(Boolean).join(", ")}</p>
              {selected.description && <p className="mt-5 text-base leading-7 text-white/75">{selected.description}</p>}
              {(selected.operations || selected.capacity) && (
                <dl className="mt-6 grid gap-4 border-t border-white/10 pt-6 sm:grid-cols-2">
                  {selected.operations && <div><dt className="text-xs font-bold uppercase tracking-wider text-gold-300">Operations</dt><dd className="mt-1 text-white/85">{selected.operations}</dd></div>}
                  {selected.capacity && <div><dt className="text-xs font-bold uppercase tracking-wider text-gold-300">Capacity</dt><dd className="mt-1 text-white/85">{selected.capacity}</dd></div>}
                </dl>
              )}
              <Link href="/contact-us" className="btn-sheen mt-auto inline-flex w-fit items-center rounded-xl bg-gradient-to-b from-gold-400 to-gold-500 px-5 py-3 font-bold text-ink shadow-lg shadow-gold-500/25 transition hover:from-gold-300 hover:to-gold-400">Enquire about this location</Link>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center py-10 text-center">
              <span aria-hidden className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400 to-gold-700 text-white shadow-xl shadow-gold-500/25"><LuMapPin className="size-8" /></span>
              <h3 className="text-xl font-bold text-white">{locations.length ? "Select a location" : "Locations coming soon"}</h3>
              <p className="mt-2 max-w-xs text-white/65">{locations.length ? "Click a pin on the globe, or a place in the list below, to see what we do there." : "Our mines, processing centres and ports will appear on the globe as soon as they are added. To discuss a region, get in touch with our team."}</p>
              {locations.length === 0 && <Link href="/contact-us" className="btn-sheen mt-6 inline-flex rounded-xl bg-gradient-to-b from-gold-400 to-gold-500 px-5 py-3 font-bold text-ink shadow-lg shadow-gold-500/25">Contact us</Link>}
            </div>
          )}
        </aside>
      </div>

      {/* Every location */}
      {shown.length > 0 && (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((l) => {
            const on = l.id === selected?.id;
            return (
              <li key={l.id}>
                <button type="button" onClick={() => choose(l.id, true)} aria-pressed={on}
                  className={`group flex h-full w-full cursor-pointer items-start gap-4 rounded-2xl border p-5 text-left transition duration-300 hover:-translate-y-1 ${on ? "border-gold-400 bg-white/10 shadow-xl shadow-gold-500/10" : "border-white/10 bg-white/[0.04] hover:border-gold-400/50 hover:bg-white/[0.07]"}`}>
                  <span aria-hidden className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: `${l.color}33`, color: l.color }}><LuMapPin className="size-5" /></span>
                  <span className="min-w-0">
                    <span className="block font-bold text-white">{l.name}</span>
                    <span className="block text-sm text-white/65">{[l.city, l.country].filter(Boolean).join(", ")}</span>
                    <span className="mt-2 inline-block rounded-md bg-white/10 px-2 py-0.5 text-xs font-semibold text-white/80">{l.type}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
