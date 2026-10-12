"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Lock, Search, X } from "lucide-react";
import { ACTION_LABEL, MODULES, RESOURCES, getResource, permKey, type Action, type ResourceDef } from "@/lib/authz/catalog";
import { scopeCovers, type Scope } from "@/lib/authz/resolve";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Inherited = Record<string, { scope: Scope; viaRoles: string[] }>;
export type Overrides = Record<string, { effect: "allow" | "deny"; scope: Scope }>;
export type Granted = Record<string, Scope>;

interface BaseProps {
  /** What the person editing may hand out. Anything missing here is shown locked. */
  delegable: Record<string, Scope>;
  readOnly?: boolean;
}
interface RoleProps extends BaseProps {
  mode: "role";
  granted: Granted;
  onGrantedChange: (next: Granted) => void;
}
interface EmployeeProps extends BaseProps {
  mode: "employee";
  inherited: Inherited;
  overrides: Overrides;
  onOverridesChange: (next: Overrides) => void;
}
export type PermissionTreeProps = RoleProps | EmployeeProps;

type CellState = "none" | "granted" | "role" | "individual" | "role+individual" | "denied";

const FILTERS = [
  { value: "all", label: "All permissions" },
  { value: "granted", label: "Granted" },
  { value: "none", label: "Not granted" },
  { value: "denied", label: "Denied (override)" },
  { value: "individual", label: "Individually granted" },
  { value: "locked", label: "Not delegable by me" },
] as const;

/** The state of one permission for display. Mirrors the server policy: deny beats role grants. */
function stateOf(p: PermissionTreeProps, key: string): CellState {
  if (p.mode === "role") return p.granted[key] ? "granted" : "none";
  const o = p.overrides[key];
  if (o?.effect === "deny") return "denied";
  const inh = p.inherited[key];
  if (inh && o?.effect === "allow") return "role+individual";
  if (inh) return "role";
  if (o?.effect === "allow") return "individual";
  return "none";
}

const isOn = (s: CellState) => s !== "none" && s !== "denied";

/** The permissions that end up effective for the employee, given inherited grants and overrides (mirrors resolve.ts). */
export function effectiveKeys(inherited: Inherited, overrides: Overrides): Record<string, Scope> {
  const out: Record<string, Scope> = {};
  for (const [k, g] of Object.entries(inherited)) out[k] = g.scope;
  for (const [k, o] of Object.entries(overrides)) if (o.effect === "allow") out[k] = out[k] && scopeCovers(out[k], o.scope) ? out[k] : o.scope;
  for (const [k, o] of Object.entries(overrides)) if (o.effect === "deny") delete out[k];
  for (const k of Object.keys(out)) {
    const [res, act] = [k.slice(0, k.lastIndexOf(":")), k.slice(k.lastIndexOf(":") + 1)];
    if (act !== "view" && !out[permKey(res, "view")]) delete out[k];
  }
  return out;
}

export function diffKeys(before: Record<string, Scope>, after: Record<string, Scope>) {
  const added = Object.keys(after).filter((k) => !before[k]);
  const removed = Object.keys(before).filter((k) => !after[k]);
  const scoped = Object.keys(after).filter((k) => before[k] && before[k] !== after[k]);
  return { added, removed, scoped };
}

export function PermissionTree(props: PermissionTreeProps) {
  const { delegable, readOnly } = props;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(MODULES.map((m) => [m.key, true])));
  const [openRes, setOpenRes] = useState<Record<string, boolean>>({});

  const canHandOut = (key: string, scope: Scope = "all") => !!delegable[key] && scopeCovers(delegable[key], scope);

  /* ───── mutations ───── */
  const setGranted = (next: Granted) => props.mode === "role" && props.onGrantedChange(next);
  const setOverrides = (next: Overrides) => props.mode === "employee" && props.onOverridesChange(next);

  /** Scope of the resource's currently-on permissions (so one selector governs the whole page). */
  const resourceScope = (r: ResourceDef): Scope => {
    for (const a of r.actions) {
      const key = permKey(r.key, a);
      if (props.mode === "role" && props.granted[key]) return props.granted[key];
      if (props.mode === "employee") {
        if (props.overrides[key]?.effect === "allow") return props.overrides[key].scope;
        if (props.inherited[key]) return props.inherited[key].scope;
      }
    }
    return "all";
  };

  const toggle = (r: ResourceDef, action: Action) => {
    if (readOnly) return;
    const key = permKey(r.key, action);
    const state = stateOf(props, key);
    const scope = resourceScope(r);

    if (props.mode === "role") {
      const next = { ...props.granted };
      if (next[key]) {
        if (!canHandOut(key, next[key])) return; // cannot remove what you cannot grant
        delete next[key];
        if (action === "view") r.actions.forEach((a) => delete next[permKey(r.key, a)]); // no actions without view
      } else {
        if (!canHandOut(key, scope)) return;
        next[key] = scope;
        const view = permKey(r.key, "view");
        if (action !== "view" && !next[view] && canHandOut(view, scope)) next[view] = scope; // view is the gate
      }
      setGranted(next);
      return;
    }

    const next = { ...props.overrides };
    if (state === "denied") delete next[key]; // lift the denial
    else if (state === "role" || state === "role+individual") next[key] = { effect: "deny", scope: "all" }; // restrict an inherited grant
    else if (state === "individual") delete next[key]; // remove an individual grant
    else {
      if (!canHandOut(key, scope)) return;
      next[key] = { effect: "allow", scope };
      const view = permKey(r.key, "view");
      const viewOn = isOn(stateOf(props, view)) || next[view]?.effect === "allow";
      if (action !== "view" && !viewOn && canHandOut(view, scope)) next[view] = { effect: "allow", scope };
    }
    setOverrides(next);
  };

  const setScope = (r: ResourceDef, scope: Scope) => {
    if (readOnly) return;
    if (props.mode === "role") {
      const next = { ...props.granted };
      r.actions.forEach((a) => { if (next[permKey(r.key, a)]) next[permKey(r.key, a)] = scope; });
      setGranted(next);
    } else {
      const next = { ...props.overrides };
      r.actions.forEach((a) => { const k = permKey(r.key, a); if (next[k]?.effect === "allow") next[k] = { effect: "allow", scope }; });
      setOverrides(next);
    }
  };

  /** Bulk: grant everything the actor can hand out on these resources. */
  const grantAll = (resources: ResourceDef[]) => {
    if (readOnly) return;
    if (props.mode === "role") {
      const next = { ...props.granted };
      for (const r of resources) for (const a of r.actions) { const k = permKey(r.key, a); if (!next[k] && canHandOut(k)) next[k] = "all"; }
      setGranted(next);
    } else {
      const next = { ...props.overrides };
      for (const r of resources) for (const a of r.actions) {
        const k = permKey(r.key, a);
        const st = stateOf(props, k);
        if (st === "none" && canHandOut(k)) next[k] = { effect: "allow", scope: "all" };
        else if (st === "denied") delete next[k];
      }
      setOverrides(next);
    }
  };

  /** Bulk: clear what this editor controls (role: grants; employee: every override on these resources). */
  const clearAll = (resources: ResourceDef[]) => {
    if (readOnly) return;
    if (props.mode === "role") {
      const next = { ...props.granted };
      for (const r of resources) for (const a of r.actions) { const k = permKey(r.key, a); if (next[k] && canHandOut(k, next[k])) delete next[k]; }
      setGranted(next);
    } else {
      const next = { ...props.overrides };
      for (const r of resources) for (const a of r.actions) delete next[permKey(r.key, a)];
      setOverrides(next);
    }
  };

  /* ───── filtering ───── */
  const term = query.trim().toLowerCase();
  const visibleResources = (moduleKey: string) =>
    RESOURCES.filter((r) => r.module === moduleKey).filter((r) => {
      if (term && !`${r.label} ${r.key} ${r.actions.map((a) => ACTION_LABEL[a]).join(" ")}`.toLowerCase().includes(term)) return false;
      if (filter === "all") return true;
      return r.actions.some((a) => {
        const key = permKey(r.key, a);
        const st = stateOf(props, key);
        if (filter === "granted") return isOn(st);
        if (filter === "none") return st === "none";
        if (filter === "denied") return st === "denied";
        if (filter === "individual") return st === "individual" || st === "role+individual";
        return !canHandOut(key) && st === "none";
      });
    });

  const everything = useMemo(() => RESOURCES, []);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <input
            type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search permissions…" aria-label="Search permissions"
            className="h-9 w-full rounded-md border border-line bg-white pl-9 pr-8 text-sm placeholder:text-faint focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-ink"><X className="size-3.5" /></button>}
        </div>
        <select aria-label="Filter permissions" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="h-9 rounded-md border border-line bg-white px-3 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">
          {FILTERS.filter((f) => props.mode === "employee" || ["all", "granted", "none", "locked"].includes(f.value)).map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <div className="flex gap-2 lg:ml-auto">
          <Button variant="secondary" size="sm" onClick={() => setOpen(Object.fromEntries(MODULES.map((m) => [m.key, true])))}>Expand all</Button>
          <Button variant="secondary" size="sm" onClick={() => setOpen({})}>Collapse all</Button>
          {!readOnly && <Button variant="secondary" size="sm" onClick={() => grantAll(everything)}>{props.mode === "role" ? "Select all permitted" : "Allow all delegable"}</Button>}
          {!readOnly && <Button variant="secondary" size="sm" onClick={() => clearAll(everything)}>{props.mode === "role" ? "Clear all" : "Clear overrides"}</Button>}
        </div>
      </div>

      <Legend mode={props.mode} />

      <div className="space-y-3">
        {MODULES.map((m) => {
          const resources = visibleResources(m.key);
          if (resources.length === 0) return null;
          const all = RESOURCES.filter((r) => r.module === m.key);
          const total = all.reduce((n, r) => n + r.actions.length, 0);
          const on = all.reduce((n, r) => n + r.actions.filter((a) => isOn(stateOf(props, permKey(r.key, a)))).length, 0);
          const expanded = open[m.key] ?? false;
          return (
            <section key={m.key} className="overflow-hidden rounded-lg border border-line bg-white">
              <header className="flex items-center gap-2 bg-canvas/60 px-3 py-2.5">
                <button type="button" onClick={() => setOpen((o) => ({ ...o, [m.key]: !expanded }))} aria-expanded={expanded} className="flex flex-1 items-center gap-2 text-left">
                  {expanded ? <ChevronDown className="size-4 text-muted" /> : <ChevronRight className="size-4 text-muted" />}
                  <span className="text-sm font-semibold text-ink">{m.label}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs text-muted ring-1 ring-line">{on} / {total}</span>
                </button>
                {!readOnly && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => grantAll(all)}>{props.mode === "role" ? "Select module" : "Allow module"}</Button>
                    <Button variant="ghost" size="sm" onClick={() => clearAll(all)}>{props.mode === "role" ? "Clear" : "Reset"}</Button>
                  </div>
                )}
              </header>
              {expanded && (
                <ul className="divide-y divide-line">
                  {resources.map((r) => {
                    const scopable = !!getResource(r.key)?.scopable;
                    const anyOn = r.actions.some((a) => isOn(stateOf(props, permKey(r.key, a))));
                    const scope = resourceScope(r);
                    const viewDelegable = delegable[permKey(r.key, "view")];
                    const resOpen = openRes[r.key] ?? true;
                    return (
                      <li key={r.key} className="px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button type="button" onClick={() => setOpenRes((o) => ({ ...o, [r.key]: !resOpen }))} aria-expanded={resOpen} className="flex items-center gap-1.5 text-sm font-medium text-ink">
                            {resOpen ? <ChevronDown className="size-3.5 text-muted" /> : <ChevronRight className="size-3.5 text-muted" />}
                            {r.label}
                          </button>
                          {r.sensitive && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-warn-600">Critical</span>}
                          {scopable && anyOn && (
                            <select
                              aria-label={`Record scope for ${r.label}`} value={scope} disabled={readOnly} onChange={(e) => setScope(r, e.target.value as Scope)}
                              className="ml-1 h-7 rounded border border-line bg-white px-2 text-xs"
                            >
                              <option value="all" disabled={viewDelegable === "assigned"}>All records</option>
                              <option value="assigned">Assigned to them only</option>
                            </select>
                          )}
                          {!readOnly && (
                            <div className="ml-auto flex gap-1">
                              <button type="button" onClick={() => grantAll([r])} className="text-xs text-brand-600 hover:underline">{props.mode === "role" ? "Select all" : "Allow all"}</button>
                              <span className="text-faint">·</span>
                              <button type="button" onClick={() => clearAll([r])} className="text-xs text-muted hover:underline">{props.mode === "role" ? "Clear" : "Reset"}</button>
                            </div>
                          )}
                        </div>
                        {resOpen && (
                          <div className="mt-2 flex flex-wrap gap-2 pl-5">
                            {r.actions.map((a) => {
                              const key = permKey(r.key, a);
                              const st = stateOf(props, key);
                              const inh = props.mode === "employee" ? props.inherited[key] : undefined;
                              const locked = !readOnly && st === "none" && !canHandOut(key, scope);
                              const lockedRemove = props.mode === "role" && st === "granted" && !canHandOut(key, props.granted[key]);
                              const disabled = !!readOnly || locked || lockedRemove;
                              const title =
                                st === "role" || st === "role+individual" ? `Granted through role: ${inh?.viaRoles.join(", ")}${st === "role" ? ". Click to deny for this employee." : ""}`
                                : st === "individual" ? "Granted individually. Click to remove."
                                : st === "denied" ? "Denied for this employee (overrides roles). Click to lift the denial."
                                : locked ? "You cannot delegate this permission because you do not hold it."
                                : lockedRemove ? "You cannot change a permission you do not hold."
                                : st === "granted" ? "Granted. Click to remove." : "Not granted. Click to grant.";
                              return (
                                <button
                                  key={a} type="button" role="checkbox" aria-checked={isOn(st)} disabled={disabled} title={title} onClick={() => toggle(r, a)}
                                  aria-label={`${r.label}: ${ACTION_LABEL[a]}. ${title}`}
                                  className={cn(
                                    "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] transition-colors disabled:cursor-not-allowed",
                                    st === "none" && "border-line bg-white text-muted hover:border-brand-200 hover:bg-brand-50",
                                    st === "granted" && "border-brand-500 bg-brand-50 text-brand-700",
                                    st === "role" && "border-brand-200 bg-brand-50 text-brand-700",
                                    (st === "individual" || st === "role+individual") && "border-green-600 bg-success-50 text-success-600",
                                    st === "denied" && "border-red-600 bg-danger-50 text-danger-600 line-through",
                                    disabled && st === "none" && "opacity-50 hover:border-line hover:bg-white",
                                  )}
                                >
                                  {locked || lockedRemove ? <Lock className="size-3" aria-hidden /> : <span className={cn("size-3 rounded-sm border", isOn(st) ? "border-current bg-current" : "border-current")} aria-hidden />}
                                  {ACTION_LABEL[a]}
                                  {(st === "role" || st === "role+individual") && <span className="ml-0.5 rounded bg-white/70 px-1 text-[10px] font-medium">Role</span>}
                                  {st === "individual" && <span className="ml-0.5 rounded bg-white/70 px-1 text-[10px] font-medium">Individual</span>}
                                  {st === "denied" && <span className="ml-0.5 rounded bg-white/70 px-1 text-[10px] font-medium no-underline">Denied</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
        {MODULES.every((m) => visibleResources(m.key).length === 0) && <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">No permissions match your search or filter.</p>}
      </div>
    </div>
  );
}

function Legend({ mode }: { mode: "role" | "employee" }) {
  const items = mode === "employee"
    ? [["border-brand-200 bg-brand-50", "Granted through a role"], ["border-green-600 bg-success-50", "Granted individually"], ["border-red-600 bg-danger-50", "Denied through an override"], ["border-line bg-white", "Not granted"]]
    : [["border-brand-500 bg-brand-50", "Granted"], ["border-line bg-white", "Not granted"]];
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legend">
      {items.map(([cls, label]) => <span key={label} className="inline-flex items-center gap-1.5"><span className={cn("size-3 rounded-sm border", cls)} aria-hidden />{label}</span>)}
      <span className="inline-flex items-center gap-1.5"><Lock className="size-3" aria-hidden /> Not delegable by you</span>
    </div>
  );
}
