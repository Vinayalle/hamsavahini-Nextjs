"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LuFileText as FileText, LuSearch as Search } from "react-icons/lu";
import { ALL_NAV_ITEMS } from "@/config/navigation";
import { useAll } from "@/hooks/use-resource";
import { apiFetch, isApiMode } from "@/lib/api/client";
import {
  careerService, enquiryService, postService, productService, projectService, rfqService,
} from "@/lib/services";

interface Hit {
  label: string;
  hint: string;
  href: string;
}

/** Database mode: the server searches only the modules (and records) this employee may see. */
function useApiHits(q: string): Hit[] {
  const [hits, setHits] = useState<Hit[]>([]);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHits([]);
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      apiFetch<{ items: Hit[] }>(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctl.signal })
        .then((r) => setHits([...ALL_NAV_ITEMS.filter((i) => i.label.toLowerCase().includes(term.toLowerCase())).map((i) => ({ label: i.label, hint: "Page", href: i.href })), ...r.items].slice(0, 8)))
        .catch(() => undefined);
    }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);
  return hits;
}

function useMockHits(q: string): Hit[] {
  const products = useAll(productService);
  const posts = useAll(postService);
  const projects = useAll(projectService);
  const careers = useAll(careerService);
  const rfqs = useAll(rfqService);
  const enquiries = useAll(enquiryService);

  return useMemo<Hit[]>(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];
    const match = (...s: (string | undefined)[]) => s.some((x) => x?.toLowerCase().includes(term));
    return [
      ...ALL_NAV_ITEMS.filter((i) => match(i.label)).map((i) => ({ label: i.label, hint: "Page", href: i.href })),
      ...products.filter((p) => match(p.name, p.code)).map((p) => ({ label: p.name, hint: `Product · ${p.code}`, href: `/admin/products/${p.id}` })),
      ...posts.filter((p) => match(p.title)).map((p) => ({ label: p.title, hint: "Post", href: `/admin/posts/${p.id}` })),
      ...projects.filter((p) => match(p.title, p.client)).map((p) => ({ label: p.title, hint: "Project", href: `/admin/projects/${p.id}` })),
      ...careers.filter((c) => match(c.title)).map((c) => ({ label: c.title, hint: "Career", href: `/admin/careers/${c.id}` })),
      ...rfqs.filter((r) => match(r.reference, r.companyName)).map((r) => ({ label: `${r.reference} · ${r.companyName}`, hint: "RFQ", href: `/admin/rfqs?search=${encodeURIComponent(r.reference)}` })),
      ...enquiries.filter((e) => match(e.name, e.subject)).map((e) => ({ label: `${e.name} – ${e.subject}`, hint: "Enquiry", href: `/admin/enquiries?search=${encodeURIComponent(e.name)}` })),
    ].slice(0, 8);
  }, [q, products, posts, projects, careers, rfqs, enquiries]);
}
const useHits = isApiMode ? useApiHits : useMockHits;

export function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const hits = useHits(q);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const go = (h: Hit) => {
    setOpen(false);
    setQ("");
    router.push(h.href);
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-xs flex-1 lg:max-w-sm">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === "Enter" && hits[active]) go(hits[active]);
        }}
        placeholder="Search pages, products, RFQs…"
        aria-label="Global search"
        role="combobox"
        aria-expanded={open && q.trim().length >= 2}
        aria-controls="global-search-results"
        className="h-9 w-full rounded-md border border-line bg-canvas pl-9 pr-3 text-sm placeholder:text-faint focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
      />
      {open && q.trim().length >= 2 && (
        <ul
          id="global-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-11 z-50 max-h-80 overflow-auto rounded-lg border border-line bg-surface p-1 shadow-pop"
        >
          {hits.length === 0 && <li className="px-3 py-3 text-sm text-muted">No results for “{q}”.</li>}
          {hits.map((h, i) => (
            <li key={h.href + h.label} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(h)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm ${i === active ? "bg-canvas" : ""}`}
              >
                <FileText className="size-4 shrink-0 text-faint" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{h.label}</span>
                <span className="shrink-0 text-xs text-muted">{h.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
