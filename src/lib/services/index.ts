import { createCollection, registerActivityRecorder, type CollectionOptions, type CrudService } from "@/lib/mock/collection";
import { isApiMode } from "@/lib/api/client";
import { createApiCollection } from "@/lib/api/collection";
import { categoriesSeed, productsSeed } from "@/lib/mock/data/catalog";
import { bannersSeed, careersSeed, locationsSeed, postsSeed, projectsSeed } from "@/lib/mock/data/content";
import {
  applicationsSeed, commoditiesSeed, commodityPricesSeed, enquiriesSeed, opportunitiesSeed, rfqsSeed,
} from "@/lib/mock/data/trade";
import {
  activitySeed, documentsSeed, mediaSeed, notificationLogsSeed, rolesSeed, templatesSeed, usersSeed,
} from "@/lib/mock/data/admin";
import type { BaseEntity } from "@/types/common";
import type {
  ActivityLog, AdminUser, Banner, Career, Category, Commodity, CommodityPrice, ContactEnquiry,
  DocumentFile, EmailTemplate, JobApplication, Location, MediaAsset, NotificationLog, Post, Product,
  Project, Rfq, Role, TradeOpportunity,
} from "@/types/entities";

/**
 * Service registry. Each export satisfies `CrudService<T>`; replace the factory with an
 * HTTP-backed implementation of the same interface to integrate the real backend.
 */
const productFilters = {
  featured: (p: Product, v: string) => String(p.featured) === v,
  status: (p: Product, v: string) => (v === "active" ? p.status !== "archived" : p.status === v),
};

/** Fields the products API accepts. Pictures and documents go as file ids (the files were uploaded and saved inside the project). */
const PRODUCT_WRITE_FIELDS = ["name", "code", "slug", "categoryId", "shortDescription", "description", "specifications", "seo", "status", "featured", "images", "documents"];
function toProductPayload(v: Record<string, unknown>): Record<string, unknown> {
  const out = Object.fromEntries(Object.entries(v).filter(([k]) => PRODUCT_WRITE_FIELDS.includes(k)));
  if (Array.isArray(out.specifications)) out.specifications = (out.specifications as { label: string; value: string; unit?: string }[]).map(({ label, value, unit }) => ({ label, value, unit: unit || null }));
  if (Array.isArray(out.images)) out.images = (out.images as { fileId?: string; alt: string; isPrimary: boolean }[]).filter((i) => i.fileId).map(({ fileId, alt, isPrimary }) => ({ fileId, alt, isPrimary }));
  if (Array.isArray(out.documents)) out.documents = (out.documents as { fileId?: string; type: string }[]).filter((d) => d.fileId).map(({ fileId, type }) => ({ fileId, type }));
  return out;
}

export const productService: CrudService<Product> = isApiMode
  ? createApiCollection<Product>({ name: "products", path: "/api/products", searchFields: ["name", "code", "shortDescription"], filters: productFilters, statusField: "status", toPayload: toProductPayload })
  : createCollection<Product>(productsSeed, {
      name: "products", entityType: "Product", labelOf: (p) => p.name,
      searchFields: ["name", "code", "shortDescription"], filters: productFilters, statusField: "status",
    });

export const categoryService: CrudService<Category> = isApiMode
  ? createApiCollection<Category>({ name: "categories", path: "/api/categories", searchFields: ["name", "slug", "description"], statusField: "status", defaultSort: { by: "sortOrder", dir: "asc" } })
  : createCollection<Category>(categoriesSeed, {
      name: "categories", entityType: "Category", labelOf: (c) => c.name,
      searchFields: ["name", "slug", "description"], statusField: "status",
      defaultSort: { by: "sortOrder", dir: "asc" },
    });

/**
 * Generic CMS modules. In api mode each one is backed by PostgreSQL through /api/<resource> (the server authorizes every call,
 * and there is NO fallback to the mock when a request fails); in mock mode it is the in-memory collection.
 * `ALLOWED` lists the fields the API accepts on write, so nothing the server does not persist is ever sent (or silently dropped).
 */
const ALLOWED: Record<string, string[]> = {
  "/api/posts": ["title", "slug", "excerpt", "content", "category", "author", "tags", "seo", "status"],
  "/api/projects": ["title", "slug", "client", "commodity", "region", "summary", "content", "startDate", "endDate", "projectStatus", "status", "featured"],
  "/api/careers": ["title", "slug", "department", "location", "employmentType", "experience", "description", "requirements", "deadline", "openings", "status"],
  "/api/locations": ["name", "type", "country", "city", "address", "description", "operations", "capacity", "latitude", "longitude", "phone", "email", "active"],
  "/api/banners": ["title", "subtitle", "section", "ctaLabel", "ctaUrl", "sortOrder", "imageFileId", "status", "startsAt", "endsAt"],
  "/api/commodities": ["name", "slug", "code", "group", "unit", "description", "status"],
  "/api/commodity-prices": ["commodityId", "price", "currency", "unit", "market", "effectiveDate", "status"],
  "/api/trade-opportunities": ["title", "commodityId", "type", "category", "quantity", "originRegion", "destinationRegion", "incoterm", "validUntil", "description", "status"],
  "/api/rfqs": ["status", "assignedToId", "notes"],
  "/api/enquiries": ["status", "assignedToId", "notes"],
  "/api/applications": ["status", "notes"],
  "/api/email-templates": ["key", "name", "subject", "body", "active"],
  "/api/notifications": ["status"],
  "/api/media": ["name", "altText", "folder"],
  "/api/documents": ["title", "category", "version", "visibility", "status"],
};

function mk<T extends BaseEntity>(path: string, seed: T[], opts: CollectionOptions<T>): CrudService<T> {
  if (!isApiMode) return createCollection<T>(seed, opts);
  const allowed = ALLOWED[path];
  return createApiCollection<T>({
    name: opts.name, path, searchFields: opts.searchFields, filters: opts.filters, defaultSort: opts.defaultSort, statusField: opts.statusField, archivedValue: opts.archivedValue,
    toPayload: allowed
      ? (v) => {
          const out = Object.fromEntries(Object.entries(v).filter(([k]) => allowed.includes(k)));
          // Only the text of a note is sent: the server assigns the author and time from the signed-in employee.
          if (Array.isArray(out.notes)) out.notes = (out.notes as { id?: string; text: string }[]).map((n) => ({ id: n.id, text: n.text }));
          return out;
        }
      : undefined,
  });
}

export const postService = mk<Post>("/api/posts", postsSeed, {
  name: "posts", entityType: "Post", labelOf: (p) => p.title,
  searchFields: ["title", "excerpt", "author", "tags"], statusField: "status",
});

export const projectService = mk<Project>("/api/projects", projectsSeed, {
  name: "projects", entityType: "Project", labelOf: (p) => p.title,
  searchFields: ["title", "client", "commodity", "region"], statusField: "status",
  filters: { featured: (p, v) => String(p.featured) === v },
});

export const careerService = mk<Career>("/api/careers", careersSeed, {
  name: "careers", entityType: "Career", labelOf: (c) => c.title,
  searchFields: ["title", "department", "location"], statusField: "status", archivedValue: "closed",
});

export const locationService = mk<Location>("/api/locations", locationsSeed, {
  name: "locations", entityType: "Location", labelOf: (l) => l.name,
  searchFields: ["name", "country", "city", "address"],
  filters: { active: (l, v) => String(l.active) === v },
});

export const bannerService = mk<Banner>("/api/banners", bannersSeed, {
  name: "banners", entityType: "Banner", labelOf: (b) => b.title,
  searchFields: ["title", "subtitle"], statusField: "status",
  defaultSort: { by: "sortOrder", dir: "asc" },
});

export const commodityService = mk<Commodity>("/api/commodities", commoditiesSeed, {
  name: "commodities", entityType: "Commodity", labelOf: (c) => c.name,
  searchFields: ["name", "code", "group"], statusField: "status",
});

export const commodityPriceService = mk<CommodityPrice>("/api/commodity-prices", commodityPricesSeed, {
  name: "commodity-prices", entityType: "Commodity price",
  labelOf: (p) => `${commodityService.snapshot().find((c) => c.id === p.commodityId)?.name ?? "Commodity"} – ${p.effectiveDate}`,
  searchFields: ["market", "currency"], statusField: "status", archivedValue: "draft",
  defaultSort: { by: "effectiveDate", dir: "desc" },
});

export const opportunityService = mk<TradeOpportunity>("/api/trade-opportunities", opportunitiesSeed, {
  name: "opportunities", entityType: "Trade opportunity", labelOf: (o) => o.title,
  searchFields: ["title", "originRegion", "destinationRegion"], statusField: "status", archivedValue: "closed",
});

export const rfqService = mk<Rfq>("/api/rfqs", rfqsSeed, {
  name: "rfqs", entityType: "RFQ", labelOf: (r) => r.reference,
  searchFields: ["reference", "companyName", "contactName", "productOrCommodity", "country"],
  statusField: "status", archivedValue: "closed",
  filters: { status: (r, v) => (v === "pending" ? r.status === "new" || r.status === "contacted" : r.status === v) },
});

export const enquiryService = mk<ContactEnquiry>("/api/enquiries", enquiriesSeed, {
  name: "enquiries", entityType: "Contact enquiry", labelOf: (e) => `${e.name} – ${e.subject}`,
  searchFields: ["name", "email", "subject", "message", "company"], statusField: "status", archivedValue: "closed",
  filters: { status: (e, v) => (v === "open" ? e.status === "new" || e.status === "contacted" : e.status === v) },
});

export const applicationService = mk<JobApplication>("/api/applications", applicationsSeed, {
  name: "applications", entityType: "Job application", labelOf: (a) => a.applicantName,
  searchFields: ["applicantName", "email", "currentCompany"], statusField: "status", archivedValue: "rejected",
  filters: { status: (a, v) => (v === "open" ? !["hired", "rejected"].includes(a.status) : a.status === v) },
});

export const userService = createCollection<AdminUser>(usersSeed, {
  name: "users", entityType: "Admin user", labelOf: (u) => u.name,
  searchFields: ["name", "email"], statusField: "status", archivedValue: "suspended",
});

export const roleService = createCollection<Role>(rolesSeed, {
  name: "roles", entityType: "Role", labelOf: (r) => r.name,
  searchFields: ["name", "description"], defaultSort: { by: "name", dir: "asc" },
});

export const mediaService = mk<MediaAsset>("/api/media", mediaSeed, {
  name: "media", entityType: "Media asset", labelOf: (m) => m.name,
  searchFields: ["name", "altText", "folder"],
});

export const documentService = mk<DocumentFile>("/api/documents", documentsSeed, {
  name: "documents", entityType: "Document", labelOf: (d) => d.title,
  searchFields: ["title", "fileName", "category"], statusField: "status",
});

export const templateService = mk<EmailTemplate>("/api/email-templates", templatesSeed, {
  name: "templates", entityType: "Email template", labelOf: (t) => t.name,
  searchFields: ["name", "key", "subject"], defaultSort: { by: "name", dir: "asc" },
  filters: { active: (t, v) => String(t.active) === v },
});

export const notificationService = mk<NotificationLog>("/api/notifications", notificationLogsSeed, {
  name: "notifications", entityType: "Notification", labelOf: (n) => n.subject,
  searchFields: ["recipient", "subject", "templateKey"], statusField: "status", silent: true,
});

export const activityService = mk<ActivityLog>("/api/activity-logs", activitySeed, {
  name: "activity", entityType: "Activity", labelOf: (a) => a.entityLabel,
  searchFields: ["actor", "entityType", "entityLabel", "detail"], silent: true,
  defaultSort: { by: "createdAt", dir: "desc" },
});

/** Wire mutations from every collection into the Activity Log (mock stand-in for server audit logs). */
if (!isApiMode) {
  registerActivityRecorder((entry) => {
    void activityService.create({ actor: "Rahul Varma", ...entry });
  });
}
