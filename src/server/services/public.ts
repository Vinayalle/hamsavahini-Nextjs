import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "../db";
import { cleanHtml } from "../resources/sanitize";
import { CONTACT } from "@/content/site";

/**
 * Read-only data for the PUBLIC website. Nothing here needs a session, so every query is limited to what an editor has deliberately
 * published (status, schedule, "active" flags) and returns only fields that are safe to show: no ids of internal records beyond what a
 * URL needs, no author accounts, no notes, no private files. Rich text is sanitised again on the way out (defence in depth).
 */
export interface Loaded<T> { data: T; failed: boolean }

/** Runs a query and, if the database is unreachable, returns the fallback instead of breaking the page. */
export async function loadPublic<T>(task: () => Promise<T>, fallback: T): Promise<Loaded<T>> {
  try {
    return { data: await task(), failed: false };
  } catch (e) {
    console.error("[site] public data unavailable", (e as { code?: string }).code ?? (e instanceof Error ? e.name : "unknown"));
    return { data: fallback, failed: true };
  }
}

const db = () => getDb();
const today = () => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())); };
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const ymd = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const num = (d: { toString(): string } | null | undefined) => (d == null ? null : Number(d.toString()));

/* ───────────── Contact details (fixed in the code: src/content/site.ts) ───────────── */
export interface PublicSettings {
  email: string;
  phone: string;
  address: string;
}
/** The details every page needs (footer, Contact Us, privacy policy, search-engine data). Fixed in the code, never read from the database. */
export async function getSiteSettings(): Promise<PublicSettings> {
  return { email: CONTACT.email.trim(), phone: CONTACT.phone.trim(), address: CONTACT.address.trim() };
}

/* ───────────── Posts (Insights) ───────────── */
export const POST_CATEGORY_LABEL: Record<string, string> = { market_insight: "Market Insight", company_news: "Company News", sustainability: "Sustainability", industry_report: "Industry Report" };
export interface PostCard { slug: string; title: string; excerpt: string; category: string; categoryKey: string; author: string; date: string; tags: string[] }
export interface PostFull extends PostCard { html: string; metaTitle: string; metaDescription: string }
const postWhere = { status: "published" as const };

const toPostCard = (p: { slug: string; title: string; excerpt: string; category: string; authorName: string; publishedAt: Date | null; createdAt: Date; tags: string[] }): PostCard => ({
  slug: p.slug, title: p.title, excerpt: p.excerpt, category: POST_CATEGORY_LABEL[p.category] ?? p.category, categoryKey: p.category, author: p.authorName, date: (p.publishedAt ?? p.createdAt).toISOString(), tags: p.tags,
});
const postSelect = { slug: true, title: true, excerpt: true, category: true, authorName: true, publishedAt: true, createdAt: true, tags: true } as const;

export async function listPosts(opts: { category?: string; take?: number; skip?: number } = {}) {
  const where = { ...postWhere, ...(opts.category && opts.category in POST_CATEGORY_LABEL ? { category: opts.category as "market_insight" } : {}) };
  const [rows, total] = await Promise.all([
    db().post.findMany({ where, orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }], take: opts.take ?? 12, skip: opts.skip ?? 0, select: postSelect }),
    db().post.count({ where }),
  ]);
  return { items: rows.map(toPostCard), total };
}
export async function getPost(slug: string): Promise<PostFull | null> {
  const p = await db().post.findFirst({ where: { ...postWhere, slug }, select: { ...postSelect, contentHtml: true, metaTitle: true, metaDescription: true } });
  return p ? { ...toPostCard(p), html: cleanHtml(p.contentHtml), metaTitle: p.metaTitle, metaDescription: p.metaDescription } : null;
}
export async function relatedPosts(slug: string, category: string, take = 3) {
  const rows = await db().post.findMany({ where: { ...postWhere, slug: { not: slug }, category: category as "market_insight" }, orderBy: [{ publishedAt: "desc" }], take, select: postSelect });
  return rows.map(toPostCard);
}

/* ───────────── Projects / trade stories ───────────── */
export const PROJECT_STAGE_LABEL: Record<string, string> = { planning: "Planning", active: "In progress", completed: "Completed", on_hold: "On hold" };
export interface ProjectCard { slug: string; title: string; summary: string; client: string; commodity: string; region: string; stage: string; stageKey: string; start: string | null; end: string | null; featured: boolean }
export interface ProjectFull extends ProjectCard { html: string }
const projectSelect = { slug: true, title: true, summary: true, client: true, commodityName: true, region: true, stage: true, startDate: true, endDate: true, featured: true } as const;
const toProjectCard = (p: { slug: string; title: string; summary: string; client: string; commodityName: string; region: string; stage: string; startDate: Date; endDate: Date | null; featured: boolean }): ProjectCard => ({
  slug: p.slug, title: p.title, summary: p.summary, client: p.client, commodity: p.commodityName, region: p.region, stage: PROJECT_STAGE_LABEL[p.stage] ?? p.stage, stageKey: p.stage, start: ymd(p.startDate), end: ymd(p.endDate), featured: p.featured,
});
export async function listProjects(take = 24) {
  const rows = await db().project.findMany({ where: { status: "published" }, orderBy: [{ featured: "desc" }, { startDate: "desc" }], take, select: projectSelect });
  return rows.map(toProjectCard);
}
export async function getProject(slug: string): Promise<ProjectFull | null> {
  const p = await db().project.findFirst({ where: { status: "published", slug }, select: { ...projectSelect, contentHtml: true } });
  return p ? { ...toProjectCard(p), html: cleanHtml(p.contentHtml) } : null;
}

/* ───────────── Products ───────────── */
export const AVAILABILITY_LABEL: Record<string, string> = { available: "Available", limited_availability: "Limited availability", under_negotiation: "Under negotiation", sold: "Sold", out_of_stock: "Out of stock" };
export interface CategoryCard { slug: string; name: string; description: string; count: number }
export interface ProductCard { slug: string; code: string; name: string; category: string; categorySlug: string; shortDescription: string; availability: string; grade: string | null; origin: string | null; featured: boolean; /** Primary picture (public image route), or null when the product has none. */ image: string | null }
export interface ProductFull extends ProductCard {
  description: string; applications: string[]; packaging: string | null; loadingPort: string | null; targetMarket: string | null; quantity: string | null;
  specifications: { label: string; value: string; unit: string | null }[];
  /** Every public picture of the product, primary first. */
  gallery: { url: string; alt: string }[];
}
const productSelect = {
  slug: true, code: true, name: true, shortDescription: true, availability: true, grade: true, origin: true, featured: true, category: { select: { name: true, slug: true } },
  images: { where: { file: { visibility: "public", scanStatus: { not: "quarantined" } } }, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1, select: { fileId: true } },
} satisfies Prisma.ProductSelect;
type ProductRow = { slug: string; code: string; name: string; shortDescription: string; availability: string; grade: string | null; origin: string | null; featured: boolean; category: { name: string; slug: string }; images: { fileId: string }[] };
const toProductCard = (p: ProductRow): ProductCard => ({
  slug: p.slug, code: p.code, name: p.name, category: p.category.name, categorySlug: p.category.slug, shortDescription: p.shortDescription,
  availability: AVAILABILITY_LABEL[p.availability] ?? p.availability, grade: p.grade, origin: p.origin, featured: p.featured,
  image: p.images[0] ? `/api/public/product-image/${p.images[0].fileId}` : null,
});
const productWhere = { status: "published" as const, category: { status: "published" as const } };

export async function listCategories(): Promise<CategoryCard[]> {
  const rows = await db().category.findMany({ where: { status: "published" }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { slug: true, name: true, description: true, _count: { select: { products: { where: { status: "published" } } } } } });
  return rows.map((c) => ({ slug: c.slug, name: c.name, description: c.description, count: c._count.products }));
}
export async function listProducts(opts: { category?: string; search?: string; take?: number; skip?: number } = {}) {
  const where = {
    ...productWhere,
    ...(opts.category ? { category: { status: "published" as const, slug: opts.category } } : {}),
    ...(opts.search ? { OR: [{ name: { contains: opts.search, mode: "insensitive" as const } }, { shortDescription: { contains: opts.search, mode: "insensitive" as const } }, { code: { contains: opts.search, mode: "insensitive" as const } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    db().product.findMany({ where, orderBy: [{ featured: "desc" }, { name: "asc" }], take: opts.take ?? 12, skip: opts.skip ?? 0, select: productSelect }),
    db().product.count({ where }),
  ]);
  return { items: rows.map(toProductCard), total };
}
/** The newest published products (by publish date), for the home page. */
export async function listRecentProducts(take = 6): Promise<ProductCard[]> {
  const rows = await db().product.findMany({ where: productWhere, orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }], take, select: productSelect });
  return rows.map(toProductCard);
}
export async function getProduct(slug: string): Promise<ProductFull | null> {
  const p = await db().product.findFirst({
    where: { ...productWhere, slug },
    select: { ...productSelect, images: { where: { file: { visibility: "public", scanStatus: { not: "quarantined" } } }, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], select: { fileId: true, alt: true } }, description: true, applications: true, packaging: true, loadingPort: true, targetMarket: true, availableQuantity: true, quantityUnit: true, specifications: { orderBy: { sortOrder: "asc" }, select: { label: true, value: true, unit: true } } },
  });
  if (!p) return null;
  const q = num(p.availableQuantity);
  return {
    ...toProductCard(p), description: p.description, applications: p.applications, packaging: p.packaging, loadingPort: p.loadingPort, targetMarket: p.targetMarket,
    quantity: q !== null ? `${q.toLocaleString("en-US")} ${p.quantityUnit ?? ""}`.trim() : null, specifications: p.specifications,
    gallery: p.images.map((i) => ({ url: `/api/public/product-image/${i.fileId}`, alt: i.alt || p.name })),
  };
}
export async function relatedProducts(slug: string, categorySlug: string, take = 3) {
  const rows = await db().product.findMany({ where: { ...productWhere, slug: { not: slug }, category: { status: "published", slug: categorySlug } }, take, orderBy: [{ featured: "desc" }, { name: "asc" }], select: productSelect });
  return rows.map(toProductCard);
}

/* ───────────── Careers ───────────── */
export const EMPLOYMENT_LABEL: Record<string, string> = { full_time: "Full time", part_time: "Part time", contract: "Contract", internship: "Internship" };
export interface CareerCard { slug: string; title: string; department: string; location: string; type: string; experience: string; deadline: string; openings: number }
export interface CareerFull extends CareerCard { descriptionHtml: string; requirementsHtml: string; id: string }
const careerWhere = () => ({ status: "open" as const, deadline: { gte: today() } });
const careerSelect = { slug: true, title: true, department: true, location: true, employmentType: true, experience: true, deadline: true, openings: true } as const;
const toCareerCard = (c: { slug: string; title: string; department: string; location: string; employmentType: string; experience: string; deadline: Date; openings: number }): CareerCard => ({
  slug: c.slug, title: c.title, department: c.department, location: c.location, type: EMPLOYMENT_LABEL[c.employmentType] ?? c.employmentType, experience: c.experience, deadline: ymd(c.deadline)!, openings: c.openings,
});
export async function listCareers() {
  const rows = await db().career.findMany({ where: careerWhere(), orderBy: [{ deadline: "asc" }], select: careerSelect });
  return rows.map(toCareerCard);
}
export async function getCareer(slug: string): Promise<CareerFull | null> {
  const c = await db().career.findFirst({ where: { ...careerWhere(), slug }, select: { ...careerSelect, id: true, descriptionHtml: true, requirementsHtml: true } });
  return c ? { ...toCareerCard(c), id: c.id, descriptionHtml: cleanHtml(c.descriptionHtml), requirementsHtml: cleanHtml(c.requirementsHtml) } : null;
}

/* ───────────── Global operations (locations) ───────────── */
export const LOCATION_TYPE_LABEL: Record<string, string> = {
  headquarters: "Headquarters", regional_office: "Regional office", mine: "Mine", sourcing_location: "Sourcing location", supplier: "Supplier", processing_facility: "Processing facility",
  warehouse: "Warehouse", port_terminal: "Port terminal", market: "Market", trading_destination: "Trading destination", representative: "Representative",
};
export interface LocationCard { id: string; name: string; type: string; typeKey: string; country: string; city: string; description: string; operations: string | null; capacity: string | null }
export async function listLocations(): Promise<LocationCard[]> {
  const rows = await db().location.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, type: true, country: true, city: true, description: true, operations: true, capacity: true } });
  return rows.map((l) => ({ ...l, type: LOCATION_TYPE_LABEL[l.type] ?? l.type, typeKey: l.type }));
}

/* ───────────── Commodity desk ───────────── */
export interface PriceRow { slug: string; name: string; code: string; group: string; price: number; currency: string; unit: string; market: string; date: string }
export async function listPrices(): Promise<PriceRow[]> {
  const commodities = await db().commodity.findMany({
    where: { status: "published" }, orderBy: [{ group: "asc" }, { name: "asc" }],
    select: { slug: true, name: true, code: true, group: true, prices: { where: { status: "published" }, orderBy: { effectiveDate: "desc" }, take: 1, select: { price: true, currency: true, unit: true, market: true, effectiveDate: true } } },
  });
  return commodities.flatMap((c) => (c.prices[0] ? [{ slug: c.slug, name: c.name, code: c.code, group: c.group, price: num(c.prices[0].price)!, currency: c.prices[0].currency, unit: c.prices[0].unit, market: c.prices[0].market, date: ymd(c.prices[0].effectiveDate)! }] : []));
}
export const OPPORTUNITY_STATUS_LABEL: Record<string, string> = { available: "Available", limited_availability: "Limited availability", under_negotiation: "Under negotiation", requirement_open: "Requirement open" };
export interface OpportunityRow { id: string; title: string; type: "buy" | "sell"; commodity: string; quantity: string; origin: string; destination: string; incoterm: string; validUntil: string; description: string; status: string }
export async function listOpportunities(): Promise<OpportunityRow[]> {
  const rows = await db().tradeOpportunity.findMany({
    where: { status: { in: ["available", "limited_availability", "under_negotiation", "requirement_open"] }, validUntil: { gte: today() }, commodity: { status: "published" } },
    orderBy: [{ validUntil: "asc" }], take: 30,
    select: { id: true, title: true, type: true, quantityValue: true, quantityUnit: true, originRegion: true, destinationRegion: true, incoterm: true, validUntil: true, description: true, status: true, commodity: { select: { name: true } } },
  });
  return rows.map((o) => ({ id: o.id, title: o.title, type: o.type, commodity: o.commodity.name, quantity: `${num(o.quantityValue)!.toLocaleString("en-US")} ${o.quantityUnit}`, origin: o.originRegion, destination: o.destinationRegion, incoterm: o.incoterm, validUntil: ymd(o.validUntil)!, description: o.description, status: OPPORTUNITY_STATUS_LABEL[o.status] ?? o.status }));
}

/* ───────────── Sitemap ───────────── */
export async function listSitemapEntries() {
  const [posts, projects, products, careers] = await Promise.all([
    db().post.findMany({ where: postWhere, select: { slug: true, updatedAt: true } }),
    db().project.findMany({ where: { status: "published" }, select: { slug: true, updatedAt: true } }),
    db().product.findMany({ where: productWhere, select: { slug: true, updatedAt: true } }),
    db().career.findMany({ where: careerWhere(), select: { slug: true, updatedAt: true } }),
  ]);
  return [
    ...posts.map((p) => ({ path: `/insights/${p.slug}`, updated: iso(p.updatedAt)! })),
    ...projects.map((p) => ({ path: `/projects/${p.slug}`, updated: iso(p.updatedAt)! })),
    ...products.map((p) => ({ path: `/products/${p.slug}`, updated: iso(p.updatedAt)! })),
    ...careers.map((p) => ({ path: `/careers/${p.slug}`, updated: iso(p.updatedAt)! })),
  ];
}
