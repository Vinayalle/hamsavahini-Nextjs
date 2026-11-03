"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { LuCheck as Check, LuChevronDown as ChevronDown, LuPlus as Plus } from "react-icons/lu";
import { cn } from "@/lib/utils";

/**
 * A category field that is also the place to make categories: type to filter the existing ones, pick one, or type a new name and choose
 * "Add ... as a new category". Nothing is created here; the form that uses it creates the category when the product is saved.
 */
export function CategoryPicker({
  id, value, onChange, options, canCreate, invalid, placeholder = "Select or type a category…",
}: { id?: string; value: string; onChange: (name: string) => void; options: string[]; canCreate: boolean; invalid?: boolean; placeholder?: string }) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const query = value.trim();
  const lower = query.toLowerCase();
  const exact = options.some((o) => o.trim().toLowerCase() === lower);
  const shown = useMemo(() => (lower && !exact ? options.filter((o) => o.toLowerCase().includes(lower)) : options), [options, lower, exact]);
  const canAdd = canCreate && !!query && !exact;
  const rows = [...shown.map((name) => ({ kind: "existing" as const, name })), ...(canAdd ? [{ kind: "new" as const, name: query }] : [])];

  const choose = (name: string) => { onChange(name); setOpen(false); input.current?.focus(); };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, Math.max(rows.length - 1, 0))); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && open && rows[active]) { e.preventDefault(); choose(rows[active].name); }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <input
        ref={input} id={id} type="text" role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-invalid={invalid}
        autoComplete="off" value={value} placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)} onKeyDown={onKey}
        className="h-10 w-full rounded-lg border border-line bg-surface pl-3 pr-9 text-sm text-ink placeholder:text-faint focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25 aria-[invalid=true]:border-danger-600"
      />
      <button type="button" tabIndex={-1} aria-label="Show categories" onClick={() => { setOpen((o) => !o); input.current?.focus(); }} className="absolute right-1 top-1 flex size-8 cursor-pointer items-center justify-center rounded-md text-muted hover:text-ink">
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1.5 max-h-64 w-full overflow-auto rounded-xl border border-line bg-surface p-1 shadow-pop">
          {rows.length === 0 && <li className="px-3 py-2.5 text-sm text-muted">{canCreate ? "No categories yet. Type a name to add the first one." : "No categories to choose from."}</li>}
          {rows.map((r, i) => (
            <li
              key={`${r.kind}-${r.name}`} role="option" aria-selected={r.kind === "existing" && r.name.trim().toLowerCase() === lower}
              onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setActive(i)} onClick={() => choose(r.name)}
              className={cn("flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm", i === active ? "bg-brand-50 text-ink" : "text-ink", r.kind === "new" && "font-medium text-brand-700")}
            >
              {r.kind === "new" ? <><Plus className="size-4 shrink-0" aria-hidden /><span className="truncate">Add “{r.name}” as a new category</span></> : <><span className="truncate">{r.name}</span>{r.name.trim().toLowerCase() === lower && <Check className="ml-auto size-4 shrink-0 text-brand-600" aria-hidden />}</>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
