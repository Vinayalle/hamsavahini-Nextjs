import "server-only";
import { z } from "zod";
import { cleanHtml } from "./sanitize";
import type { ResourceConfig } from "./framework";
import { dateOnly, fromYmd, iso, num, optionalDate, optionalText, patchOf, pick, publishStatus, richText, seoSchema, slug, text, ymd } from "./shared";
import { errors } from "../errors";

/* ───────────────────────── Posts / Insights ───────────────────────── */
const POST_CATEGORY = { "Market Insight": "market_insight", "Company News": "company_news", Sustainability: "sustainability", "Industry Report": "industry_report" } as const;
const POST_CATEGORY_LABEL = Object.fromEntries(Object.entries(POST_CATEGORY).map(([k, v]) => [v, k])) as Record<string, string>;

const postSchema = z.object({
  title: text(2, 140, "Title"), slug, excerpt: text(20, 240, "Excerpt"), content: richText(30),
  category: z.enum(Object.keys(POST_CATEGORY) as [keyof typeof POST_CATEGORY, ...(keyof typeof POST_CATEGORY)[]]),
  author: text(2, 120, "Author"), tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  seo: seoSchema, status: publishStatus.default("draft"),
});

export const posts: ResourceConfig = {
  key: "posts", permission: "posts", entity: "Post", model: "post",
  toDto: (p) => ({
    id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt, content: p.contentHtml, category: POST_CATEGORY_LABEL[p.category], author: p.authorName,
    tags: p.tags, seo: { metaTitle: p.metaTitle, metaDescription: p.metaDescription, keywords: p.keywords },
    status: p.status, publishedAt: iso(p.publishedAt), createdAt: iso(p.createdAt), updatedAt: iso(p.updatedAt),
  }),
  label: (p) => p.title,
  search: ["title", "excerpt", "authorName"], sorts: ["title", "status", "publishedAt", "updatedAt", "createdAt", "authorName"], defaultSort: { by: "updatedAt", dir: "desc" },
  filters: { status: (v) => ({ status: v }), category: (v) => (v in POST_CATEGORY ? { category: POST_CATEGORY[v as keyof typeof POST_CATEGORY] } : undefined) },
  createSchema: postSchema, patchSchema: patchOf(postSchema),
  buildCreate: (i) => ({
    title: i.title, slug: i.slug, excerpt: i.excerpt, contentHtml: cleanHtml(i.content), category: POST_CATEGORY[i.category as keyof typeof POST_CATEGORY], authorName: i.author, tags: i.tags,
    metaTitle: i.seo.metaTitle, metaDescription: i.seo.metaDescription, keywords: i.seo.keywords, status: i.status, publishedAt: i.status === "published" ? new Date() : null,
  }),
  buildUpdate: (p, cur) => ({
    ...pick(p, {
      title: (v: string) => ({ title: v }), slug: (v: string) => ({ slug: v }), excerpt: (v: string) => ({ excerpt: v }),
      content: (v: string) => ({ contentHtml: cleanHtml(v) }), category: (v: keyof typeof POST_CATEGORY) => ({ category: POST_CATEGORY[v] }),
      author: (v: string) => ({ authorName: v }), tags: (v: string[]) => ({ tags: v }),
      seo: (v: { metaTitle: string; metaDescription: string; keywords: string[] }) => ({ metaTitle: v.metaTitle, metaDescription: v.metaDescription, keywords: v.keywords }),
      status: (v: string) => ({ status: v }),
    }),
    ...(p.status === "published" && !cur.publishedAt ? { publishedAt: new Date() } : {}),
  }),
  status: { field: "status", mode: "publish", values: ["draft", "published", "archived"], publishedAtField: "publishedAt" },
  unique: [{ fields: ["slug"], message: "Another post uses this slug", errorField: "slug" }],
};

/* ───────────────────────── Projects / Trade stories ───────────────────────── */
const STAGES = ["planning", "active", "completed", "on_hold"] as const;
const projectSchema = z.object({
  title: text(2, 160, "Title"), slug, client: text(2, 160, "Client"), commodity: text(2, 120, "Commodity"), region: text(2, 120, "Region"),
  summary: text(20, 300, "Summary"), content: richText(30), startDate: dateOnly, endDate: optionalDate,
  projectStatus: z.enum(STAGES), status: publishStatus.default("draft"), featured: z.boolean().default(false),
}).refine((v) => !v.endDate || v.endDate >= v.startDate, { path: ["endDate"], message: "End date cannot be before the start date" });

export const projects: ResourceConfig = {
  key: "projects", permission: "projects", entity: "Project", model: "project",
  toDto: (p) => ({
    id: p.id, title: p.title, slug: p.slug, summary: p.summary, content: p.contentHtml, client: p.client, commodity: p.commodityName, region: p.region,
    startDate: ymd(p.startDate), endDate: ymd(p.endDate), projectStatus: p.stage, status: p.status, featured: p.featured, createdAt: iso(p.createdAt), updatedAt: iso(p.updatedAt),
  }),
  label: (p) => p.title,
  search: ["title", "client", "commodityName", "region"], sorts: ["title", "status", "stage", "updatedAt", "createdAt", "client"], defaultSort: { by: "updatedAt", dir: "desc" },
  filters: { status: (v) => ({ status: v }), projectStatus: (v) => ({ stage: v }), featured: (v) => ({ featured: v === "true" }) },
  createSchema: projectSchema, patchSchema: z.object({
    title: text(2, 160), slug, client: text(2, 160), commodity: text(2, 120), region: text(2, 120), summary: text(20, 300), content: richText(30),
    startDate: dateOnly, endDate: optionalDate, projectStatus: z.enum(STAGES), status: publishStatus, featured: z.boolean(),
  }).partial(),
  buildCreate: (i) => ({
    title: i.title, slug: i.slug, client: i.client, commodityName: i.commodity, region: i.region, summary: i.summary, contentHtml: cleanHtml(i.content),
    startDate: fromYmd(i.startDate), endDate: fromYmd(i.endDate), stage: i.projectStatus, status: i.status, featured: i.featured,
  }),
  buildUpdate: (p, cur) => {
    const start = p.startDate ?? ymd(cur.startDate);
    const end = p.endDate !== undefined ? p.endDate : ymd(cur.endDate);
    if (end && start && end < start) throw errors.invalid("End date cannot be before the start date", { endDate: "End date cannot be before the start date" });
    return pick(p, {
      title: (v: string) => ({ title: v }), slug: (v: string) => ({ slug: v }), client: (v: string) => ({ client: v }), commodity: (v: string) => ({ commodityName: v }),
      region: (v: string) => ({ region: v }), summary: (v: string) => ({ summary: v }), content: (v: string) => ({ contentHtml: cleanHtml(v) }),
      startDate: (v: string) => ({ startDate: fromYmd(v) }), endDate: (v: string | null) => ({ endDate: fromYmd(v) }),
      projectStatus: (v: string) => ({ stage: v }), status: (v: string) => ({ status: v }), featured: (v: boolean) => ({ featured: v }),
    });
  },
  status: { field: "status", mode: "publish", values: ["draft", "published", "archived"] },
  unique: [{ fields: ["slug"], message: "Another project uses this slug", errorField: "slug" }],
};

/* ───────────────────────── Careers ───────────────────────── */
const CAREER_STATUS = ["draft", "open", "closed"] as const;
const EMPLOYMENT = ["full_time", "part_time", "contract", "internship"] as const;
const careerBase = z.object({
  title: text(2, 160, "Job title"), slug, department: text(2, 80, "Department"), location: text(2, 120, "Location"), employmentType: z.enum(EMPLOYMENT),
  experience: text(1, 60, "Experience"), description: richText(30), requirements: richText(20), deadline: dateOnly, openings: z.number().int().min(1).max(100),
  status: z.enum(CAREER_STATUS).default("draft"),
});

export const careers: ResourceConfig = {
  key: "careers", permission: "careers", entity: "Job opening", model: "career",
  toDto: (c) => ({
    id: c.id, title: c.title, slug: c.slug, department: c.department, location: c.location, employmentType: c.employmentType, experience: c.experience,
    description: c.descriptionHtml, requirements: c.requirementsHtml, deadline: ymd(c.deadline), openings: c.openings, status: c.status, createdAt: iso(c.createdAt), updatedAt: iso(c.updatedAt),
  }),
  label: (c) => c.title,
  search: ["title", "department", "location"], sorts: ["title", "deadline", "status", "updatedAt", "createdAt"], defaultSort: { by: "deadline", dir: "asc" },
  filters: { status: (v) => ({ status: v }), department: (v) => ({ department: v }), employmentType: (v) => ({ employmentType: v }) },
  createSchema: careerBase, patchSchema: patchOf(careerBase),
  buildCreate: (i) => ({
    title: i.title, slug: i.slug, department: i.department, location: i.location, employmentType: i.employmentType, experience: i.experience,
    descriptionHtml: cleanHtml(i.description), requirementsHtml: cleanHtml(i.requirements), deadline: fromYmd(i.deadline), openings: i.openings, status: i.status,
  }),
  buildUpdate: (p) => pick(p, {
    title: (v: string) => ({ title: v }), slug: (v: string) => ({ slug: v }), department: (v: string) => ({ department: v }), location: (v: string) => ({ location: v }),
    employmentType: (v: string) => ({ employmentType: v }), experience: (v: string) => ({ experience: v }), description: (v: string) => ({ descriptionHtml: cleanHtml(v) }),
    requirements: (v: string) => ({ requirementsHtml: cleanHtml(v) }), deadline: (v: string) => ({ deadline: fromYmd(v) }), openings: (v: number) => ({ openings: v }),
    status: (v: string) => ({ status: v }),
  }),
  status: { field: "status", mode: "publish", values: CAREER_STATUS },
  unique: [{ fields: ["slug"], message: "Another opening uses this slug", errorField: "slug" }],
  // Mirrors ON DELETE RESTRICT: applicants' personal data must never be orphaned.
  guardDelete: async (row, db) => {
    const n = await db.jobApplication.count({ where: { careerId: row.id } });
    if (n) throw errors.conflict(`${n} application${n > 1 ? "s" : ""} reference this opening. Close it instead of deleting.`);
  },
};

/* ───────────────────────── Locations (global operations) ───────────────────────── */
const LOCATION_TYPES = ["headquarters", "regional_office", "mine", "sourcing_location", "supplier", "processing_facility", "warehouse", "port_terminal", "market", "trading_destination", "representative"] as const;
const lat = z.union([z.number().min(-90).max(90), z.nan()]).optional().nullable().transform((v) => (typeof v === "number" && !Number.isNaN(v) ? v : null));
const lng = z.union([z.number().min(-180).max(180), z.nan()]).optional().nullable().transform((v) => (typeof v === "number" && !Number.isNaN(v) ? v : null));
const locationBase = z.object({
  name: text(2, 160, "Name"), type: z.enum(LOCATION_TYPES), country: text(2, 80, "Country"), city: text(2, 80, "City"), address: text(8, 300, "Address"),
  description: z.string().trim().max(2000).default(""), operations: optionalText(1000), capacity: optionalText(200), latitude: lat, longitude: lng,
  phone: text(3, 40, "Phone"), email: z.string().trim().toLowerCase().email("Enter a valid email").max(254), active: z.boolean().default(true),
});

export const locations: ResourceConfig = {
  key: "locations", permission: "locations", entity: "Location", model: "location",
  toDto: (l) => ({
    id: l.id, name: l.name, type: l.type, country: l.country, city: l.city, address: l.address, description: l.description, operations: l.operations ?? "", capacity: l.capacity ?? "",
    latitude: num(l.latitude), longitude: num(l.longitude), phone: l.phone, email: l.email, active: l.active, createdAt: iso(l.createdAt), updatedAt: iso(l.updatedAt),
  }),
  label: (l) => l.name,
  search: ["name", "country", "city", "address"], sorts: ["name", "type", "country", "active", "updatedAt"], defaultSort: { by: "name", dir: "asc" },
  filters: { type: (v) => ({ type: v }), active: (v) => ({ active: v === "true" }) },
  createSchema: locationBase, patchSchema: patchOf(locationBase),
  buildCreate: (i) => ({ name: i.name, type: i.type, country: i.country, city: i.city, address: i.address, description: i.description, operations: i.operations, capacity: i.capacity, latitude: i.latitude, longitude: i.longitude, phone: i.phone, email: i.email, active: i.active }),
  buildUpdate: (p) => pick(p, {
    name: (v: string) => ({ name: v }), type: (v: string) => ({ type: v }), country: (v: string) => ({ country: v }), city: (v: string) => ({ city: v }), address: (v: string) => ({ address: v }),
    description: (v: string) => ({ description: v }), operations: (v: string | null) => ({ operations: v }), capacity: (v: string | null) => ({ capacity: v }),
    latitude: (v: number | null) => ({ latitude: v }), longitude: (v: number | null) => ({ longitude: v }), phone: (v: string) => ({ phone: v }), email: (v: string) => ({ email: v }), active: (v: boolean) => ({ active: v }),
  }),
  visibility: { field: "active" },
  unique: [{ fields: ["name", "city"], message: "A location with this name already exists in that city", errorField: "name" }],
};

/* ───────────────────────── Banners ───────────────────────── */
const SECTIONS = ["hero", "promo", "feature_strip", "cta"] as const;
const bannerBase = z.object({
  title: text(2, 100, "Headline"), subtitle: z.string().trim().max(200).default(""), section: z.enum(SECTIONS), ctaLabel: text(1, 60, "Button label"),
  ctaUrl: z.string().trim().min(1).max(300).regex(/^(\/|https?:\/\/)/, "Use /path or https://…"), sortOrder: z.number().int().min(0).max(999),
  status: publishStatus.default("draft"), startsAt: optionalDate, endsAt: optionalDate,
}).refine((v) => !v.startsAt || !v.endsAt || v.endsAt >= v.startsAt, { path: ["endsAt"], message: "End date cannot be before the start date" });

export const banners: ResourceConfig = {
  key: "banners", permission: "banners", entity: "Banner", model: "banner",
  toDto: (b) => ({
    id: b.id, title: b.title, subtitle: b.subtitle, section: b.section, ctaLabel: b.ctaLabel, ctaUrl: b.ctaUrl, sortOrder: b.sortOrder, status: b.status,
    startsAt: ymd(b.startsAt), endsAt: ymd(b.endsAt), createdAt: iso(b.createdAt), updatedAt: iso(b.updatedAt),
  }),
  label: (b) => b.title,
  search: ["title", "subtitle"], sorts: ["sortOrder", "title", "status", "section", "updatedAt"], defaultSort: { by: "sortOrder", dir: "asc" },
  filters: { status: (v) => ({ status: v }), section: (v) => ({ section: v }) },
  createSchema: bannerBase, patchSchema: z.object({
    title: text(2, 100), subtitle: z.string().trim().max(200), section: z.enum(SECTIONS), ctaLabel: text(1, 60), ctaUrl: z.string().trim().min(1).max(300).regex(/^(\/|https?:\/\/)/, "Use /path or https://…"),
    sortOrder: z.number().int().min(0).max(999), status: publishStatus, startsAt: optionalDate, endsAt: optionalDate,
  }).partial(),
  buildCreate: (i) => ({ title: i.title, subtitle: i.subtitle, section: i.section, ctaLabel: i.ctaLabel, ctaUrl: i.ctaUrl, sortOrder: i.sortOrder, status: i.status, startsAt: fromYmd(i.startsAt), endsAt: fromYmd(i.endsAt) }),
  buildUpdate: (p) => pick(p, {
    title: (v: string) => ({ title: v }), subtitle: (v: string) => ({ subtitle: v }), section: (v: string) => ({ section: v }), ctaLabel: (v: string) => ({ ctaLabel: v }), ctaUrl: (v: string) => ({ ctaUrl: v }),
    sortOrder: (v: number) => ({ sortOrder: v }), status: (v: string) => ({ status: v }), startsAt: (v: string | null) => ({ startsAt: fromYmd(v) }), endsAt: (v: string | null) => ({ endsAt: fromYmd(v) }),
  }),
  status: { field: "status", mode: "publish", values: ["draft", "published", "archived"] },
};
