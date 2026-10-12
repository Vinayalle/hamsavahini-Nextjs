"use client";

import { RecordFormPage, type RecordFormConfig } from "./record-form-page";
import type { FieldDef, SectionDef, Values } from "@/components/forms/entity-form";
import type { BaseEntity } from "@/types/common";
import { useAll } from "@/hooks/use-resource";
import { isApiMode } from "@/lib/api/client";
import {
  bannerService, careerService, commodityService, locationService, opportunityService, postService, projectService,
} from "@/lib/services";
import type {
  Banner, Career, Commodity, Location, Post, Project, TradeOpportunity,
} from "@/types/entities";

/** File uploads need object storage. Until it is configured, database mode does not offer image fields (it would pretend to save them). */
const withoutFiles = (sections: SectionDef[]): SectionDef[] => (isApiMode ? sections.map((s) => ({ ...s, fields: s.fields.filter((f) => f.type !== "image") })).filter((s) => s.fields.length) : sections);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && !Number.isNaN(v) ? v : 0);
const opts = (...vals: string[]) => vals.map((v) => ({ value: v, label: v.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) }));
const seoFields: FieldDef[] = [
  { name: "seoTitle", label: "Meta title", type: "text", maxLength: 70, hint: "Up to 70 characters." },
  { name: "seoDescription", label: "Meta description", type: "textarea", maxLength: 160, hint: "Up to 160 characters.", rows: 2 },
  { name: "seoKeywords", label: "Keywords", type: "tags" },
];

/* ─────────────────────────── Posts ─────────────────────────── */
const postSections: SectionDef[] = [
  { title: "Post Content", description: "Title, summary and body of the article.", fields: [
    { name: "title", label: "Title", type: "text", required: true, maxLength: 140, wide: true },
    { name: "slug", label: "URL slug", type: "slug", required: true, slugFrom: "title" },
    { name: "category", label: "Category", type: "select", required: true, options: opts("Market Insight", "Company News", "Sustainability", "Industry Report").map((o) => ({ value: o.value, label: o.value })) },
    { name: "author", label: "Author", type: "text", required: true },
    { name: "excerpt", label: "Excerpt", type: "textarea", required: true, maxLength: 240, minLength: 20, hint: "Shown on listing pages. Max 240 characters." },
    { name: "content", label: "Body", type: "richtext", required: true, minLength: 30 },
  ] },
  { title: "Media & Tags", fields: [
    { name: "coverImage", label: "Cover image", type: "image" },
    { name: "tags", label: "Tags", type: "tags" },
  ] },
  { title: "SEO Settings", fields: seoFields },
  { title: "Publishing", fields: [
    { name: "status", label: "Status", type: "select", required: true, options: opts("draft", "published", "archived") },
  ] },
];

export const postConfig: RecordFormConfig<Post> = {
  service: postService, entityLabel: "post", listHref: "/admin/posts", listLabel: "posts",
  afterSaveHref: (p) => `/admin/posts/${p.id}`,
  sections: withoutFiles(postSections), nameOf: (p) => p.title,
  toValues: (p) => ({ title: p.title, slug: p.slug, category: p.category, author: p.author, excerpt: p.excerpt, content: p.content, coverImage: p.coverImage ?? "", tags: p.tags, seoTitle: p.seo.metaTitle, seoDescription: p.seo.metaDescription, seoKeywords: p.seo.keywords, status: p.status }),
  toPayload: (v, ex) => ({
    title: str(v.title), slug: str(v.slug), category: str(v.category) as Post["category"], author: str(v.author),
    excerpt: str(v.excerpt), content: str(v.content), coverImage: str(v.coverImage) || undefined, tags: (v.tags as string[]) ?? [],
    seo: { metaTitle: str(v.seoTitle), metaDescription: str(v.seoDescription), keywords: (v.seoKeywords as string[]) ?? [] },
    status: str(v.status) as Post["status"],
    publishedAt: v.status === "published" ? ex?.publishedAt ?? new Date().toISOString() : ex?.publishedAt ?? null,
  }),
  validate: (v, ex) => postService.snapshot().some((p) => p.id !== ex?.id && p.slug === v.slug) ? { slug: "Another post already uses this slug" } : null,
};
export const PostFormPage = ({ id }: { id?: string }) => <RecordFormPage id={id} config={postConfig} />;

/* ─────────────────────────── Projects ─────────────────────────── */
export const projectConfig: RecordFormConfig<Project> = {
  service: projectService, entityLabel: "project", listHref: "/admin/projects", listLabel: "projects",
  afterSaveHref: (p) => `/admin/projects/${p.id}`,
  nameOf: (p) => p.title,
  sections: [
    { title: "Project Details", fields: [
      { name: "title", label: "Title", type: "text", required: true, wide: true },
      { name: "slug", label: "URL slug", type: "slug", required: true, slugFrom: "title" },
      { name: "client", label: "Client", type: "text", required: true },
      { name: "commodity", label: "Commodity", type: "text", required: true },
      { name: "region", label: "Region", type: "text", required: true },
      { name: "summary", label: "Summary", type: "textarea", required: true, minLength: 20, maxLength: 300 },
      { name: "content", label: "Story", type: "richtext", required: true, minLength: 30 },
    ] },
    { title: "Timeline & Status", fields: [
      { name: "startDate", label: "Start date", type: "date", required: true },
      { name: "endDate", label: "End date", type: "date", hint: "Leave empty for ongoing projects." },
      { name: "projectStatus", label: "Project stage", type: "select", required: true, options: opts("planning", "active", "completed", "on_hold") },
      { name: "status", label: "Publish status", type: "select", required: true, options: opts("draft", "published", "archived") },
      { name: "featured", label: "Featured on homepage", type: "switch" },
    ] },
  ],
  toValues: (p) => ({ ...p, endDate: p.endDate ?? "" }),
  toPayload: (v) => ({
    title: str(v.title), slug: str(v.slug), client: str(v.client), commodity: str(v.commodity), region: str(v.region),
    summary: str(v.summary), content: str(v.content), startDate: str(v.startDate), endDate: str(v.endDate) || null,
    projectStatus: str(v.projectStatus) as Project["projectStatus"], status: str(v.status) as Project["status"], featured: !!v.featured,
  }),
  validate: (v, ex) => {
    const out: Record<string, string> = {};
    if (v.endDate && str(v.endDate) < str(v.startDate)) out.endDate = "End date cannot be before the start date";
    if (projectService.snapshot().some((p) => p.id !== ex?.id && p.slug === v.slug)) out.slug = "Another project already uses this slug";
    return out;
  },
};
export const ProjectFormPage = ({ id }: { id?: string }) => <RecordFormPage id={id} config={projectConfig} />;

/* ─────────────────────────── Careers ─────────────────────────── */
export const careerConfig: RecordFormConfig<Career> = {
  service: careerService, entityLabel: "job opening", listHref: "/admin/careers", listLabel: "careers",
  afterSaveHref: (c) => `/admin/careers/${c.id}`,
  nameOf: (c) => c.title,
  sections: [
    { title: "Role", fields: [
      { name: "title", label: "Job title", type: "text", required: true, wide: true },
      { name: "slug", label: "URL slug", type: "slug", required: true, slugFrom: "title" },
      { name: "department", label: "Department", type: "select", required: true, options: opts("Trading", "Operations", "Finance", "Marketing", "Legal", "Technology").map((o) => ({ value: o.value, label: o.value })) },
      { name: "location", label: "Location", type: "text", required: true, placeholder: "Mumbai, India" },
      { name: "employmentType", label: "Employment type", type: "select", required: true, options: [{ value: "full_time", label: "Full time" }, { value: "part_time", label: "Part time" }, { value: "contract", label: "Contract" }, { value: "internship", label: "Internship" }] },
      { name: "experience", label: "Experience", type: "text", required: true, placeholder: "5+ years" },
      { name: "openings", label: "Number of openings", type: "number", required: true, min: 1, max: 100 },
      { name: "deadline", label: "Application deadline", type: "date", required: true },
    ] },
    { title: "Job Description", fields: [
      { name: "description", label: "Description & responsibilities", type: "richtext", required: true, minLength: 30 },
      { name: "requirements", label: "Requirements", type: "richtext", required: true, minLength: 20 },
    ] },
    { title: "Publishing", fields: [{ name: "status", label: "Status", type: "select", required: true, options: [{ value: "draft", label: "Draft" }, { value: "open", label: "Open" }, { value: "closed", label: "Closed" }] }] },
  ],
  toValues: (c) => ({ ...c }),
  toPayload: (v) => ({
    title: str(v.title), slug: str(v.slug), department: str(v.department), location: str(v.location),
    employmentType: str(v.employmentType) as Career["employmentType"], experience: str(v.experience),
    description: str(v.description), requirements: str(v.requirements), deadline: str(v.deadline),
    openings: num(v.openings), status: str(v.status) as Career["status"],
  }),
  validate: (v, ex) => {
    const out: Record<string, string> = {};
    const today = new Date().toISOString().slice(0, 10);
    if (v.status === "open" && str(v.deadline) < today) out.deadline = "Deadline must be today or later for an open role";
    if (careerService.snapshot().some((c) => c.id !== ex?.id && c.slug === v.slug)) out.slug = "Another opening already uses this slug";
    return out;
  },
};
export const CareerFormPage = ({ id }: { id?: string }) => <RecordFormPage id={id} config={careerConfig} />;

/* ─────────────────────────── Locations ─────────────────────────── */
export const locationConfig: RecordFormConfig<Location> = {
  service: locationService, entityLabel: "location", listHref: "/admin/locations", listLabel: "locations",
  nameOf: (l) => l.name,
  sections: [
    { title: "Location Details", fields: [
      { name: "name", label: "Name", type: "text", required: true, wide: true },
      { name: "type", label: "Type", type: "select", required: true, options: [{ value: "headquarters", label: "Headquarters" }, { value: "regional_office", label: "Regional office" }, { value: "mine", label: "Mine" }, { value: "sourcing_location", label: "Sourcing location" }, { value: "supplier", label: "Supplier" }, { value: "processing_facility", label: "Processing facility" }, { value: "warehouse", label: "Warehouse" }, { value: "port_terminal", label: "Port / terminal" }, { value: "market", label: "Market" }, { value: "trading_destination", label: "Trading destination" }, { value: "representative", label: "Representative office" }] },
      { name: "country", label: "Country", type: "text", required: true },
      { name: "city", label: "City", type: "text", required: true },
      { name: "address", label: "Address", type: "textarea", required: true, minLength: 8, wide: true },
      { name: "description", label: "Description", type: "textarea", maxLength: 2000, wide: true },
      { name: "operations", label: "Operations", type: "textarea", maxLength: 1000, rows: 2, wide: true },
      { name: "capacity", label: "Capacity", type: "text", maxLength: 200 },
      { name: "phone", label: "Phone", type: "tel", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "active", label: "Shown on website", type: "switch", switchText: ["Active", "Hidden"] },
    ] },
  ],
  toValues: (l) => ({ ...l, description: l.description ?? "", operations: l.operations ?? "", capacity: l.capacity ?? "" }),
  toPayload: (v) => ({ name: str(v.name), type: str(v.type) as Location["type"], country: str(v.country), city: str(v.city), address: str(v.address), description: str(v.description), operations: str(v.operations) || null, capacity: str(v.capacity) || null, phone: str(v.phone), email: str(v.email), active: !!v.active } as never),
};
export const LocationFormPage = ({ id }: { id?: string }) => <RecordFormPage id={id} config={locationConfig} />;

/* ─────────────────────────── Banners ─────────────────────────── */
/** Database mode uploads the picture to the server (saved inside the project) and keeps its file id; mock mode keeps a local preview URL. */
const bannerImageField: FieldDef = isApiMode
  ? { name: "imageFileId", label: "Banner image", type: "media-image", uploadPath: "/api/banners/image", previewPath: "/api/banners/image", hint: "JPEG, PNG or WebP up to 3 MB. Wide photos (1920×1080) look best on the home page." }
  : { name: "imageUrl", label: "Banner image", type: "image" };
export const bannerConfig: RecordFormConfig<Banner> = {
  service: bannerService, entityLabel: "banner", listHref: "/admin/banners", listLabel: "banners",
  nameOf: (b) => b.title,
  createDescription: "Saved banners appear as slides in the website home-page hero. Unpublish one from the banners list.",
  sections: [
    { title: "Banner Content", description: "Shown on the website home page.", fields: [
      { name: "title", label: "Banner title", type: "text", required: true, maxLength: 100, wide: true, hint: "The large heading, e.g. Enhancing Value Ensuring Quality." },
      { name: "subtitle", label: "Description", type: "textarea", maxLength: 200, rows: 2, hint: "One or two short sentences under the title. Max 200 characters." },
      bannerImageField,
      { name: "ctaUrl", label: "Link", type: "url", required: true, placeholder: "/about", hint: "Where the button goes: /page-on-this-site or https://…" },
      { name: "ctaLabel", label: "Button text", type: "text", required: true, maxLength: 60, defaultValue: "Know more" },
    ] },
  ],
  toValues: (b) => ({ ...b, imageUrl: b.imageUrl ?? "", imageFileId: b.imageFileId ?? "" }),
  // The form only edits content. A new banner is a published hero slide placed after the existing ones (the server picks the order);
  // editing keeps the banner's current placement, status and schedule. Publish / unpublish happens from the list.
  toPayload: (v, ex) => ({
    title: str(v.title), subtitle: str(v.subtitle), ctaLabel: str(v.ctaLabel), ctaUrl: str(v.ctaUrl),
    ...(isApiMode ? { imageFileId: str(v.imageFileId) || null } : { imageUrl: str(v.imageUrl) || undefined }),
    section: ex?.section ?? "hero", status: ex?.status ?? "published", startsAt: ex?.startsAt ?? null, endsAt: ex?.endsAt ?? null,
    sortOrder: ex?.sortOrder ?? (isApiMode ? undefined : bannerService.snapshot().reduce((m, x) => Math.max(m, x.sortOrder), 0) + 1),
  }) as Omit<Banner, keyof BaseEntity>,
};
export const BannerFormPage = ({ id }: { id?: string }) => <RecordFormPage id={id} config={bannerConfig} />;

/* ─────────────────────────── Commodities ─────────────────────────── */
export const commodityConfig: RecordFormConfig<Commodity> = {
  service: commodityService, entityLabel: "commodity", listHref: "/admin/commodities", listLabel: "commodities",
  nameOf: (c) => c.name,
  sections: [
    { title: "Commodity", fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "slug", label: "URL slug", type: "slug", required: true, slugFrom: "name" },
      { name: "code", label: "Trading code", type: "text", required: true, maxLength: 10, hint: "Short uppercase code, e.g. ALU" },
      { name: "group", label: "Group", type: "select", required: true, options: ["Energy", "Metals", "Agriculture", "Chemicals", "Minerals"].map((v) => ({ value: v, label: v })) },
      { name: "unit", label: "Unit of measure", type: "select", required: true, options: ["MT", "DMT", "kg", "barrel", "lb"].map((v) => ({ value: v, label: v })) },
      { name: "status", label: "Status", type: "select", required: true, options: opts("draft", "published", "archived") },
      { name: "description", label: "Description", type: "textarea", required: true, minLength: 10, wide: true },
    ] },
  ],
  toValues: (c) => ({ ...c }),
  toPayload: (v) => ({ name: str(v.name), slug: str(v.slug), code: str(v.code).toUpperCase(), group: str(v.group) as Commodity["group"], unit: str(v.unit), description: str(v.description), status: str(v.status) as Commodity["status"] }),
  validate: (v, ex) => {
    const out: Record<string, string> = {};
    if (commodityService.snapshot().some((c) => c.id !== ex?.id && c.code.toLowerCase() === str(v.code).toLowerCase())) out.code = "Another commodity uses this code";
    if (commodityService.snapshot().some((c) => c.id !== ex?.id && c.slug === v.slug)) out.slug = "Another commodity uses this slug";
    return out;
  },
};
export const CommodityFormPage = ({ id }: { id?: string }) => <RecordFormPage id={id} config={commodityConfig} />;

/* ─────────────────────────── Trade opportunities ─────────────────────────── */
export function OpportunityFormPage({ id }: { id?: string }) {
  const commodities = useAll(commodityService);
  const config: RecordFormConfig<TradeOpportunity> = {
    service: opportunityService, entityLabel: "trade opportunity", listHref: "/admin/trade-opportunities", listLabel: "trade opportunities",
    nameOf: (o) => o.title,
    sections: [
      { title: "Opportunity", fields: [
        { name: "title", label: "Title", type: "text", required: true, wide: true },
        { name: "type", label: "Buy / Sell", type: "select", required: true, options: [{ value: "buy", label: "Buying" }, { value: "sell", label: "Selling" }] },
        { name: "commodityId", label: "Commodity", type: "select", required: true, options: commodities.map((c) => ({ value: c.id, label: c.name })) },
        { name: "category", label: "Category", type: "select", required: true, options: [{ value: "available_for_sale", label: "Available for sale" }, { value: "buying_requirement", label: "Buying requirement" }, { value: "active_enquiry", label: "Active enquiry" }, { value: "spot", label: "Spot" }, { value: "long_term", label: "Long term" }, { value: "upcoming_shipment", label: "Upcoming shipment" }] },
        { name: "quantity", label: "Quantity", type: "text", required: true, placeholder: "5,000 MT" },
        { name: "incoterm", label: "Incoterm", type: "select", required: true, options: ["EXW", "FOB", "CFR", "CIF", "DAP", "DDP"].map((v) => ({ value: v, label: v })) },
        { name: "originRegion", label: "Origin region", type: "text", required: true },
        { name: "destinationRegion", label: "Destination region", type: "text", required: true },
        { name: "validUntil", label: "Valid until", type: "date", required: true },
        { name: "status", label: "Status", type: "select", required: true, options: opts("draft", "available", "limited_availability", "under_negotiation", "sold", "requirement_open", "closed") },
        { name: "description", label: "Details", type: "textarea", required: true, minLength: 10, wide: true },
      ] },
    ],
    toValues: (o) => ({ ...o }),
    toPayload: (v) => ({ title: str(v.title), type: str(v.type) as TradeOpportunity["type"], category: (str(v.category) || "available_for_sale") as TradeOpportunity["category"], commodityId: str(v.commodityId), quantity: str(v.quantity), incoterm: str(v.incoterm), originRegion: str(v.originRegion), destinationRegion: str(v.destinationRegion), validUntil: str(v.validUntil), status: str(v.status) as TradeOpportunity["status"], description: str(v.description) }),
    validate: (v: Values) => (["available", "limited_availability", "requirement_open"].includes(str(v.status)) && str(v.validUntil) < new Date().toISOString().slice(0, 10) ? { validUntil: "A live opportunity must be valid until today or later" } : null),
  };
  return <RecordFormPage id={id} config={config} />;
}

