"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Switch, Textarea } from "@/components/ui/fields";
import { Field, FormActions } from "@/components/forms/form-parts";
import { PageHeader } from "@/components/admin/page-parts";
import { useConfirm, useUnsavedChangesGuard } from "@/components/admin/dialogs";
import { useSettings } from "@/hooks/use-resource";
import { settingsService } from "@/lib/services/settings";
import { uid } from "@/lib/utils";
import type { NavMenuItem, WebsiteSettings } from "@/types/entities";

const validHref = (h: string) => /^(\/|https?:\/\/)\S*$/.test(h.trim());
const move = <T,>(arr: T[], i: number, dir: -1 | 1): T[] => {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

/* ───────────────────────── Navigation menu ───────────────────────── */
function NavigationEditor({ initial }: { initial: NavMenuItem[] }) {
  const confirm = useConfirm();
  const [items, setItems] = useState<NavMenuItem[]>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(items) !== JSON.stringify(initial);
  const { dialog } = useUnsavedChangesGuard(dirty && !saving);

  const patch = (id: string, p: Partial<NavMenuItem>) => setItems((l) => l.map((i) => (i.id === id ? { ...i, ...p } : i)));
  const patchChild = (id: string, cid: string, p: Partial<NavMenuItem["children"][number]>) =>
    setItems((l) => l.map((i) => (i.id === id ? { ...i, children: i.children.map((c) => (c.id === cid ? { ...c, ...p } : c)) } : i)));

  const save = async () => {
    const errs: Record<string, string> = {};
    items.forEach((i) => {
      if (!i.label.trim()) errs[`${i.id}.label`] = "Label is required";
      if (!validHref(i.href)) errs[`${i.id}.href`] = "Use /path or https://…";
      i.children.forEach((c) => {
        if (!c.label.trim()) errs[`${c.id}.label`] = "Label is required";
        if (!validHref(c.href)) errs[`${c.id}.href`] = "Use /path or https://…";
      });
    });
    setErrors(errs);
    if (Object.keys(errs).length) return void toast.error("Please fix the highlighted fields before saving.");
    setSaving(true);
    await settingsService.updateSection("navigation", items);
    toast.success("Navigation saved", { description: "Stored in mock data for this session only." });
  };

  const remove = async (i: NavMenuItem) => {
    if (!(await confirm({ title: "Remove menu item?", description: `“${i.label || "Untitled"}”${i.children.length ? ` and its ${i.children.length} sub-item(s)` : ""} will be removed from the menu.`, confirmLabel: "Remove", destructive: true }))) return;
    setItems((l) => l.filter((x) => x.id !== i.id));
  };

  return (
    <>
      <div className="space-y-4">
        {items.map((item, idx) => (
          <Card key={item.id}>
            <div className="flex flex-wrap items-start gap-3 p-4">
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <Field label="Label" htmlFor={`${item.id}-l`} error={errors[`${item.id}.label`]}>
                  <Input id={`${item.id}-l`} value={item.label} aria-invalid={!!errors[`${item.id}.label`]} onChange={(e) => patch(item.id, { label: e.target.value })} />
                </Field>
                <Field label="Link" htmlFor={`${item.id}-h`} error={errors[`${item.id}.href`]}>
                  <Input id={`${item.id}-h`} value={item.href} aria-invalid={!!errors[`${item.id}.href`]} onChange={(e) => patch(item.id, { href: e.target.value })} />
                </Field>
              </div>
              <div className="flex items-center gap-1 pt-6">
                <Switch checked={item.visible} onChange={(v) => patch(item.id, { visible: v })} label={`Show ${item.label} in menu`} />
                <Button variant="ghost" size="icon" aria-label={`Move ${item.label} up`} disabled={idx === 0} onClick={() => setItems(move(items, idx, -1))}><ArrowUp className="size-4" /></Button>
                <Button variant="ghost" size="icon" aria-label={`Move ${item.label} down`} disabled={idx === items.length - 1} onClick={() => setItems(move(items, idx, 1))}><ArrowDown className="size-4" /></Button>
                <Button variant="ghost" size="icon" aria-label={`Remove ${item.label}`} onClick={() => void remove(item)}><Trash2 className="size-4 text-danger-600" /></Button>
              </div>
            </div>
            {(
              <div className="border-t border-line bg-canvas/50 px-4 py-3">
                {item.children.map((c) => (
                  <div key={c.id} className="mb-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <Field label="Sub-item label" htmlFor={`${c.id}-l`} error={errors[`${c.id}.label`]}>
                      <Input id={`${c.id}-l`} value={c.label} onChange={(e) => patchChild(item.id, c.id, { label: e.target.value })} />
                    </Field>
                    <Field label="Link" htmlFor={`${c.id}-h`} error={errors[`${c.id}.href`]}>
                      <Input id={`${c.id}-h`} value={c.href} onChange={(e) => patchChild(item.id, c.id, { href: e.target.value })} />
                    </Field>
                    <div className="flex items-end">
                      <Button variant="ghost" size="icon" aria-label={`Remove sub-item ${c.label}`} onClick={() => patch(item.id, { children: item.children.filter((x) => x.id !== c.id) })}><Trash2 className="size-4 text-danger-600" /></Button>
                    </div>
                  </div>
                ))}
                <Button variant="ghost" size="sm" onClick={() => patch(item.id, { children: [...item.children, { id: uid("sub"), label: "", href: "" }] })}><Plus className="size-3.5" /> Add sub-item</Button>
              </div>
            )}
          </Card>
        ))}
        <Button variant="secondary" onClick={() => setItems([...items, { id: uid("nav"), label: "", href: "", visible: true, children: [] }])}><Plus className="size-4" /> Add menu item</Button>
      </div>
      <FormActions>
        <Button variant="secondary" disabled={!dirty} onClick={() => { setItems(initial); setErrors({}); }}>Discard changes</Button>
        <Button disabled={!dirty} loading={saving} onClick={() => void save()}>Save navigation</Button>
      </FormActions>
      {dialog}
    </>
  );
}

export function NavigationSettingsPage() {
  const { navigation } = useSettings();
  return (
    <>
      <PageHeader title="Navigation Menu" description="Order and visibility of the main website menu." />
      <NavigationEditor key={JSON.stringify(navigation)} initial={navigation} />
    </>
  );
}

/* ───────────────────────── Footer ───────────────────────── */
type Footer = WebsiteSettings["footer"];

function FooterEditor({ initial }: { initial: Footer }) {
  const confirm = useConfirm();
  const [f, setF] = useState<Footer>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const { dialog } = useUnsavedChangesGuard(dirty && !saving);

  const setCol = (id: string, p: Partial<Footer["columns"][number]>) => setF((x) => ({ ...x, columns: x.columns.map((c) => (c.id === id ? { ...c, ...p } : c)) }));

  const save = async () => {
    const errs: Record<string, string> = {};
    if (!f.copyright.trim()) errs.copyright = "Copyright text is required";
    f.columns.forEach((c) => {
      if (!c.title.trim()) errs[`${c.id}.title`] = "Column title is required";
      c.links.forEach((l, i) => {
        if (!l.label.trim()) errs[`${c.id}.${i}.label`] = "Required";
        if (!validHref(l.href)) errs[`${c.id}.${i}.href`] = "Use /path or https://…";
      });
    });
    setErrors(errs);
    if (Object.keys(errs).length) return void toast.error("Please fix the highlighted fields before saving.");
    setSaving(true);
    await settingsService.updateSection("footer", f);
    toast.success("Footer saved", { description: "Stored in mock data for this session only." });
  };

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader title="Footer Content" />
          <div className="space-y-4 p-5">
            <Field label="About text" htmlFor="about"><Textarea id="about" rows={3} value={f.aboutText} onChange={(e) => setF({ ...f, aboutText: e.target.value })} /></Field>
            <Field label="Copyright" htmlFor="copyright" required error={errors.copyright}><Input id="copyright" value={f.copyright} aria-invalid={!!errors.copyright} onChange={(e) => setF({ ...f, copyright: e.target.value })} /></Field>
            <div className="flex items-center gap-3">
              <Switch checked={f.showNewsletter} onChange={(v) => setF({ ...f, showNewsletter: v })} label="Show newsletter signup" />
              <span className="text-sm text-muted">Show newsletter signup</span>
            </div>
          </div>
        </Card>

        {f.columns.map((c) => (
          <Card key={c.id}>
            <CardHeader title={c.title || "Untitled column"} action={
              <Button variant="ghost" size="sm" onClick={async () => { if (await confirm({ title: "Remove column?", description: `“${c.title || "Untitled"}” and its links will be removed.`, confirmLabel: "Remove", destructive: true })) setF((x) => ({ ...x, columns: x.columns.filter((y) => y.id !== c.id) })); }}>
                <Trash2 className="size-3.5 text-danger-600" /> Remove column
              </Button>
            } />
            <div className="space-y-3 p-5">
              <Field label="Column title" htmlFor={`${c.id}-t`} error={errors[`${c.id}.title`]} className="max-w-sm"><Input id={`${c.id}-t`} value={c.title} onChange={(e) => setCol(c.id, { title: e.target.value })} /></Field>
              {c.links.map((l, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <Field label="Link label" htmlFor={`${c.id}-${i}-l`} error={errors[`${c.id}.${i}.label`]}><Input id={`${c.id}-${i}-l`} value={l.label} onChange={(e) => setCol(c.id, { links: c.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} /></Field>
                  <Field label="URL" htmlFor={`${c.id}-${i}-h`} error={errors[`${c.id}.${i}.href`]}><Input id={`${c.id}-${i}-h`} value={l.href} onChange={(e) => setCol(c.id, { links: c.links.map((x, j) => (j === i ? { ...x, href: e.target.value } : x)) })} /></Field>
                  <div className="flex items-end"><Button variant="ghost" size="icon" aria-label={`Remove link ${l.label}`} onClick={() => setCol(c.id, { links: c.links.filter((_, j) => j !== i) })}><Trash2 className="size-4 text-danger-600" /></Button></div>
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setCol(c.id, { links: [...c.links, { label: "", href: "" }] })}><Plus className="size-3.5" /> Add link</Button>
            </div>
          </Card>
        ))}
        <Button variant="secondary" onClick={() => setF({ ...f, columns: [...f.columns, { id: uid("col"), title: "", links: [] }] })}><Plus className="size-4" /> Add column</Button>
      </div>
      <FormActions>
        <Button variant="secondary" disabled={!dirty} onClick={() => { setF(initial); setErrors({}); }}>Discard changes</Button>
        <Button disabled={!dirty} loading={saving} onClick={() => void save()}>Save footer</Button>
      </FormActions>
      {dialog}
    </>
  );
}

export function FooterSettingsPage() {
  const { footer } = useSettings();
  return (
    <>
      <PageHeader title="Footer Settings" description="Footer text, link columns and newsletter signup." />
      <FooterEditor key={JSON.stringify(footer)} initial={footer} />
    </>
  );
}
