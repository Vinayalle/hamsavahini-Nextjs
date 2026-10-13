"use client";

import { FaArrowRight as ArrowRight } from "react-icons/fa";
import Link from "next/link";
import { LuBoxes as Boxes, LuBriefcase as Briefcase, LuCircleCheck as CheckCircle2, LuFilePen as FileEdit, LuFolderKanban as FolderKanban, LuEarth as Globe2, LuInbox as Inbox, LuMapPin as MapPin, LuMessageSquare as MessageSquare, LuNewspaper as Newspaper, LuPackage as Package, LuUsers as Users, LuClock as Clock } from "react-icons/lu";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader, StatCard } from "@/components/admin/page-parts";
import { StatusBadge } from "@/components/admin/status-badge";
import { ActivityTimeline, type TimelineEntry } from "@/components/admin/detail-parts";
import { useAll } from "@/hooks/use-resource";
import {
  activityService, applicationService, bannerService, careerService, enquiryService, locationService,
  postService, productService, projectService, rfqService, commodityService, categoryService,
} from "@/lib/services";
import { formatDate } from "@/lib/utils";

const QUICK_ACTIONS = [
  { label: "Add Product", href: "/admin/products/new", icon: Package },
  { label: "Create Post", href: "/admin/posts/new", icon: Newspaper },
  { label: "Add Project", href: "/admin/projects/new", icon: FolderKanban },
  { label: "Add Location", href: "/admin/locations/new", icon: MapPin },
  { label: "Add Commodity", href: "/admin/commodities/new", icon: Boxes },
  { label: "Review Enquiries", href: "/admin/enquiries", icon: Inbox },
];

type Counts = { published: number; draft: number; archived: number };
function countBy<T>(items: readonly T[], pick: (i: T) => string): Counts {
  const c: Counts = { published: 0, draft: 0, archived: 0 };
  for (const i of items) {
    const s = pick(i);
    if (s === "published" || s === "open" || s === "active") c.published++;
    else if (s === "draft") c.draft++;
    else c.archived++;
  }
  return c;
}

function StatusBar({ label, href, counts }: { label: string; href: string; counts: Counts }) {
  const total = counts.published + counts.draft + counts.archived || 1;
  const seg = (n: number, cls: string, name: string) =>
    n > 0 && <div className={cls} style={{ width: `${(n / total) * 100}%` }} title={`${name}: ${n}`} />;
  return (
    <Link href={href} className="block rounded-md p-1.5 hover:bg-canvas">
      <div className="mb-1.5 flex items-center justify-between text-[13px]">
        <span className="font-medium text-ink">{label}</span>
        <span className="text-muted tabular-nums">{counts.published} live · {counts.draft} draft · {counts.archived} archived</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${label}: ${counts.published} published, ${counts.draft} draft, ${counts.archived} archived`}>
        {seg(counts.published, "bg-green-600", "Published")}
        {seg(counts.draft, "bg-amber-500", "Draft")}
        {seg(counts.archived, "bg-slate-300", "Archived")}
      </div>
    </Link>
  );
}

export function MockDashboardPage() {
  const products = useAll(productService);
  const posts = useAll(postService);
  const projects = useAll(projectService);
  const locations = useAll(locationService);
  const enquiries = useAll(enquiryService);
  const rfqs = useAll(rfqService);
  const applications = useAll(applicationService);
  const careers = useAll(careerService);
  const banners = useAll(bannerService);
  const commodities = useAll(commodityService);
  const categories = useAll(categoryService);
  const activity = useAll(activityService);

  const openEnquiries = enquiries.filter((e) => e.status === "new" || e.status === "contacted").length;
  const pendingRfqs = rfqs.filter((r) => r.status === "new" || r.status === "contacted").length;
  const openApps = applications.filter((a) => !["hired", "rejected"].includes(a.status)).length;

  const recentContent = [
    ...products.map((p) => ({ id: p.id, title: p.name, type: "Product", status: p.status, at: p.updatedAt, href: `/admin/products/${p.id}` })),
    ...posts.map((p) => ({ id: p.id, title: p.title, type: "Post", status: p.status, at: p.updatedAt, href: `/admin/posts/${p.id}` })),
    ...projects.map((p) => ({ id: p.id, title: p.title, type: "Project", status: p.status, at: p.updatedAt, href: `/admin/projects/${p.id}` })),
    ...banners.map((b) => ({ id: b.id, title: b.title, type: "Banner", status: b.status, at: b.updatedAt, href: "/admin/banners" })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);

  const recentEnquiries = [...enquiries].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const recentApps = [...applications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  const timeline: TimelineEntry[] = [...activity]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 7)
    .map((a) => ({
      id: a.id,
      title: <><span className="font-medium">{a.actor}</span> {a.action.replace("_", " ")} {a.entityType.toLowerCase()} <span className="font-medium">{a.entityLabel}</span></>,
      meta: a.detail,
      at: a.createdAt,
      tone: a.action === "deleted" ? "danger" : a.action === "published" ? "success" : a.action === "created" ? "info" : "neutral",
    }));

  return (
    <>
      <PageHeader title="Dashboard" description="Overview of catalogue, content and incoming enquiries. Figures reflect the current mock dataset." />

      <section aria-label="Summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total Products" value={products.length} icon={Package} href="/admin/products" />
        <StatCard label="Published Products" value={products.filter((p) => p.status === "published").length} icon={CheckCircle2} tone="success" href="/admin/products?status=published" />
        <StatCard label="Draft Products" value={products.filter((p) => p.status === "draft").length} icon={FileEdit} tone="warn" href="/admin/products?status=draft" />
        <StatCard label="Published Posts" value={posts.filter((p) => p.status === "published").length} icon={Newspaper} tone="success" href="/admin/posts?status=published" />
        <StatCard label="Active Projects" value={projects.filter((p) => p.projectStatus === "active").length} icon={FolderKanban} href="/admin/projects?projectStatus=active" />
        <StatCard label="Active Locations" value={locations.filter((l) => l.active).length} icon={Globe2} href="/admin/locations?active=true" />
        <StatCard label="Open Contact Enquiries" value={openEnquiries} icon={MessageSquare} tone="warn" href="/admin/enquiries?status=open" />
        <StatCard label="Pending RFQs" value={pendingRfqs} icon={Clock} tone="warn" href="/admin/rfqs?status=pending" />
        <StatCard label="Open Job Applications" value={openApps} icon={Users} href="/admin/applications?status=open" />
      </section>

      <section aria-label="Quick actions" className="mt-6">
        <Card>
          <CardHeader title="Quick Actions" />
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
            {QUICK_ACTIONS.map((a) => (
              <Link key={a.label} href={a.href} className="flex flex-col items-center gap-2 rounded-lg border border-line px-3 py-4 text-center text-[13px] font-medium text-ink transition-colors hover:border-brand-200 hover:bg-brand-50">
                <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><a.icon className="size-[18px]" aria-hidden /></span>
                {a.label}
              </Link>
            ))}
          </div>
        </Card>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Recent Content Activity" description="Latest edits across products, posts, projects and banners" />
          <ul className="divide-y divide-line">
            {recentContent.map((c) => (
              <li key={`${c.type}-${c.id}`}>
                <Link href={c.href} className="flex items-center gap-3 px-5 py-3 hover:bg-canvas/60">
                  <span className="w-16 shrink-0 text-xs font-medium text-muted">{c.type}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{c.title}</span>
                  <StatusBadge status={c.status} />
                  <span className="hidden w-24 shrink-0 text-right text-xs text-muted sm:block">{formatDate(c.at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Content Status Overview" description="Published, draft and archived records" />
          <div className="space-y-1 p-3">
            <StatusBar label="Products" href="/admin/products" counts={countBy(products, (p) => p.status)} />
            <StatusBar label="Categories" href="/admin/categories" counts={countBy(categories, (p) => p.status)} />
            <StatusBar label="Posts" href="/admin/posts" counts={countBy(posts, (p) => p.status)} />
            <StatusBar label="Projects" href="/admin/projects" counts={countBy(projects, (p) => p.status)} />
            <StatusBar label="Careers" href="/admin/careers" counts={countBy(careers, (c) => c.status === "closed" ? "archived" : c.status === "open" ? "published" : "draft")} />
            <StatusBar label="Banners" href="/admin/banners" counts={countBy(banners, (p) => p.status)} />
            <StatusBar label="Commodities" href="/admin/commodities" counts={countBy(commodities, (p) => p.status)} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent Contact Enquiries" action={<Link href="/admin/enquiries" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-600 hover:underline">View all <ArrowRight className="size-3.5" /></Link>} />
          <ul className="divide-y divide-line">
            {recentEnquiries.map((e) => (
              <li key={e.id}>
                <Link href={`/admin/enquiries?search=${encodeURIComponent(e.name)}`} className="block px-5 py-3 hover:bg-canvas/60">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-ink">{e.name}</span>
                    <StatusBadge status={e.status} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted">{e.subject} · {formatDate(e.createdAt)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Recent Job Applications" action={<Link href="/admin/applications" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-600 hover:underline">View all <ArrowRight className="size-3.5" /></Link>} />
          <ul className="divide-y divide-line">
            {recentApps.map((a) => (
              <li key={a.id}>
                <Link href={`/admin/applications?search=${encodeURIComponent(a.applicantName)}`} className="block px-5 py-3 hover:bg-canvas/60">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-ink">{a.applicantName}</span>
                    <StatusBadge status={a.status} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    <Briefcase className="mr-1 inline size-3" aria-hidden />
                    {careers.find((c) => c.id === a.careerId)?.title ?? "Role"} · {formatDate(a.createdAt)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Recent Administrative Activity" action={<Link href="/admin/activity-logs" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-600 hover:underline">All logs <ArrowRight className="size-3.5" /></Link>} />
          <ActivityTimeline entries={timeline} />
        </Card>
      </div>

      <p className="mt-6 text-xs text-faint">
        Data shown is sample content held in browser memory; changes reset on reload.
      </p>
    </>
  );
}
