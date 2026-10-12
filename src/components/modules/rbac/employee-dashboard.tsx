"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/fields";
import { ErrorState, NotFoundRecord, PageHeader } from "@/components/admin/page-parts";
import { useBreadcrumbLabel } from "@/components/admin/use-breadcrumb-label";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import { useApi } from "@/lib/api/use-api";
import { useAuth } from "@/lib/auth";
import type { EmployeeDto } from "./types";

interface DashboardConfig {
  widgets: { key: string; enabled: boolean; order: number }[];
  quickActions: string[];
  available: { key: string; label: string }[];
  availableQuick: { key: string; label: string }[];
  customised: boolean;
}
interface DefaultConfig {
  widgets: string[];
  quickActions: string[];
  catalogue: { widgets: { key: string; label: string }[]; quickActions: { key: string; label: string }[] };
}

const errMsg = (e: unknown) => (e instanceof ApiClientError ? e.message : "Something went wrong");

function WidgetEditor({ data, onSave, onReset, saving }: { data: DashboardConfig; onSave: (w: DashboardConfig["widgets"], q: string[]) => void; onReset?: () => void; saving: boolean }) {
  const [widgets, setWidgets] = useState([...data.widgets].sort((a, b) => a.order - b.order));
  const [quick, setQuick] = useState(data.quickActions);
  const label = (k: string) => data.available.find((a) => a.key === k)?.label ?? k;
  const move = (i: number, d: -1 | 1) => setWidgets((l) => { const n = [...l]; const j = i + d; if (j < 0 || j >= n.length) return l; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const dirty = JSON.stringify(widgets.map((w, i) => [w.key, w.enabled, i])) !== JSON.stringify([...data.widgets].sort((a, b) => a.order - b.order).map((w, i) => [w.key, w.enabled, i])) || JSON.stringify([...quick].sort()) !== JSON.stringify([...data.quickActions].sort());
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Widgets" description="Only widgets this employee is entitled to are listed. Order is top to bottom." />
        {widgets.length === 0 ? <p className="p-5 text-sm text-muted">This employee has no permissions that unlock dashboard widgets.</p> : (
          <ul className="divide-y divide-line">
            {widgets.map((w, i) => (
              <li key={w.key} className="flex items-center gap-3 px-5 py-2.5">
                <Checkbox aria-label={`Show ${label(w.key)}`} checked={w.enabled} onChange={(e) => setWidgets((l) => l.map((x) => (x.key === w.key ? { ...x, enabled: e.target.checked } : x)))} />
                <span className="flex-1 text-sm text-ink">{label(w.key)}</span>
                <Button variant="ghost" size="icon" className="size-8" aria-label={`Move ${label(w.key)} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-4" /></Button>
                <Button variant="ghost" size="icon" className="size-8" aria-label={`Move ${label(w.key)} down`} disabled={i === widgets.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-4" /></Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <CardHeader title="Quick actions" />
        {data.availableQuick.length === 0 ? <p className="p-5 text-sm text-muted">No quick actions are available for this employee&apos;s permissions.</p> : (
          <ul className="divide-y divide-line">
            {data.availableQuick.map((q) => (
              <li key={q.key} className="flex items-center gap-3 px-5 py-2.5">
                <Checkbox aria-label={`Show quick action ${q.label}`} checked={quick.includes(q.key)} onChange={(e) => setQuick((l) => (e.target.checked ? [...l, q.key] : l.filter((x) => x !== q.key)))} />
                <span className="text-sm text-ink">{q.label}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="flex flex-wrap justify-end gap-2 lg:col-span-2">
        {onReset && <Button variant="secondary" onClick={onReset}><RotateCcw className="size-4" /> Reset to default</Button>}
        <Button disabled={!dirty} loading={saving} onClick={() => onSave(widgets.map((w, i) => ({ key: w.key, enabled: w.enabled, order: i })), quick)}>Save dashboard</Button>
      </div>
    </div>
  );
}

function DefaultDashboardCard() {
  const d = useApi<DefaultConfig>("/api/dashboard/default");
  const [saving, setSaving] = useState(false);
  if (!d.data) return null;
  const cfg: DashboardConfig = {
    widgets: d.data.widgets.map((key, order) => ({ key, enabled: true, order })).concat(d.data.catalogue.widgets.filter((w) => !d.data!.widgets.includes(w.key)).map((w, i) => ({ key: w.key, enabled: false, order: 100 + i }))),
    quickActions: d.data.quickActions, available: d.data.catalogue.widgets, availableQuick: d.data.catalogue.quickActions, customised: true,
  };
  return (
    <section className="mt-10" aria-label="Default dashboard">
      <h2 className="text-lg font-semibold text-ink">Default dashboard</h2>
      <p className="mb-4 mt-1 text-sm text-muted">Applies to every employee without a custom layout. Each employee still only sees widgets they are entitled to.</p>
      <WidgetEditor key={JSON.stringify(d.data)} data={cfg} saving={saving} onSave={async (w, q) => {
        setSaving(true);
        try { await apiFetch("/api/dashboard/default", { method: "PUT", body: { widgets: w.filter((x) => x.enabled).map((x) => x.key), quickActions: q } }); toast.success("Default dashboard saved"); void d.reload(); } catch (e) { toast.error(errMsg(e)); } finally { setSaving(false); }
      }} />
    </section>
  );
}

export function EmployeeDashboardPage({ id }: { id: string }) {
  const { can, isSuperAdmin } = useAuth();
  const emp = useApi<EmployeeDto>(`/api/users/${id}`);
  const cfg = useApi<DashboardConfig>(`/api/users/${id}/dashboard`);
  const [saving, setSaving] = useState(false);
  useBreadcrumbLabel(emp.data?.name);
  if (cfg.error?.status === 404) return <NotFoundRecord what="Employee" backHref="/admin/users" backLabel="Back to employees" />;
  if (cfg.error) return <ErrorState title="Couldn't load dashboard configuration" description={cfg.error.message} onRetry={() => void cfg.reload()} />;
  if (!cfg.data) return <PageHeader title="Dashboard configuration" description="Loading…" />;
  const editable = can("user_dashboards", "edit");
  return (
    <>
      <PageHeader title={`Dashboard: ${emp.data?.name ?? ""}`} description={cfg.data.customised ? "This employee has a custom dashboard layout." : "This employee uses the default layout for their permissions."} />
      <WidgetEditor
        key={JSON.stringify(cfg.data)} data={cfg.data} saving={saving}
        onSave={async (w, q) => {
          if (!editable) return void toast.error("You do not have permission to change dashboards.");
          setSaving(true);
          try { cfg.set(await apiFetch<DashboardConfig>(`/api/users/${id}/dashboard`, { method: "PUT", body: { widgets: w, quickActions: q } })); toast.success("Dashboard saved"); } catch (e) { toast.error(errMsg(e)); } finally { setSaving(false); }
        }}
        onReset={editable && cfg.data.customised ? async () => { try { cfg.set(await apiFetch<DashboardConfig>(`/api/users/${id}/dashboard`, { method: "DELETE" })); toast.success("Reset to the default dashboard"); } catch (e) { toast.error(errMsg(e)); } } : undefined}
      />
      {isSuperAdmin && <DefaultDashboardCard />}
    </>
  );
}
