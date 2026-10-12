import type { BaseEntity, ID, PublishStatus } from "./common";

export interface SeoFields {
  metaTitle: string;
  metaDescription: string;
  canonicalUrl?: string;
  keywords: string[];
}

export interface ProductSpec {
  id: ID;
  label: string;
  value: string;
  unit?: string;
}

export interface ProductDocument {
  id: ID;
  name: string;
  type: "datasheet" | "coa" | "msds" | "brochure" | "other";
  sizeBytes: number;
}

export interface ProductImage {
  id: ID;
  url: string;
  alt: string;
  isPrimary: boolean;
}

export interface Product extends BaseEntity {
  name: string;
  slug: string;
  code: string;
  categoryId: ID;
  shortDescription: string;
  description: string;
  images: ProductImage[];
  specifications: ProductSpec[];
  documents: ProductDocument[];
  seo: SeoFields;
  status: PublishStatus;
  featured: boolean;
  publishedAt?: string | null;
}

export interface Category extends BaseEntity {
  name: string;
  slug: string;
  description: string;
  parentId?: ID | null;
  sortOrder: number;
  status: PublishStatus;
}

export interface Post extends BaseEntity {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: "Market Insight" | "Company News" | "Sustainability" | "Industry Report";
  author: string;
  coverImage?: string;
  tags: string[];
  seo: SeoFields;
  status: PublishStatus;
  publishedAt?: string | null;
}

export interface Project extends BaseEntity {
  title: string;
  slug: string;
  summary: string;
  content: string;
  client: string;
  commodity: string;
  region: string;
  startDate: string;
  endDate?: string | null;
  projectStatus: "planning" | "active" | "completed" | "on_hold";
  status: PublishStatus;
  featured: boolean;
}

export interface Career extends BaseEntity {
  title: string;
  slug: string;
  department: string;
  location: string;
  employmentType: "full_time" | "part_time" | "contract" | "internship";
  experience: string;
  description: string;
  requirements: string;
  deadline: string;
  openings: number;
  status: "open" | "draft" | "closed";
}

export interface Location extends BaseEntity {
  name: string;
  type: "headquarters" | "regional_office" | "mine" | "sourcing_location" | "supplier" | "processing_facility" | "warehouse" | "port_terminal" | "market" | "trading_destination" | "representative";
  country: string;
  city: string;
  address: string;
  description?: string;
  operations?: string;
  capacity?: string;
  latitude?: number | null;
  longitude?: number | null;
  phone: string;
  email: string;
  active: boolean;
}

export interface Banner extends BaseEntity {
  title: string;
  subtitle: string;
  section: "hero" | "promo" | "feature_strip" | "cta";
  imageUrl?: string;
  /** Database mode: id of the uploaded banner picture (the form uploads it and sends only this id). */
  imageFileId?: string | null;
  ctaLabel: string;
  ctaUrl: string;
  sortOrder: number;
  status: PublishStatus;
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface Commodity extends BaseEntity {
  name: string;
  slug: string;
  code: string;
  group: "Energy" | "Metals" | "Agriculture" | "Chemicals" | "Minerals";
  unit: string;
  description: string;
  status: PublishStatus;
}

export interface CommodityPrice extends BaseEntity {
  commodityId: ID;
  price: number;
  currency: "USD" | "EUR" | "INR" | "AED" | "CNY";
  unit: string;
  market: string;
  effectiveDate: string;
  status: "published" | "draft";
}

export type OpportunityStatus = "draft" | "available" | "limited_availability" | "under_negotiation" | "sold" | "requirement_open" | "closed";
export type OpportunityCategory = "available_for_sale" | "buying_requirement" | "active_enquiry" | "spot" | "long_term" | "upcoming_shipment";

export interface TradeOpportunity extends BaseEntity {
  title: string;
  commodityId: ID;
  type: "buy" | "sell";
  category: OpportunityCategory;
  quantity: string;
  originRegion: string;
  destinationRegion: string;
  incoterm: string;
  validUntil: string;
  description: string;
  status: OpportunityStatus;
}

export type RfqStatus = "new" | "contacted" | "under_discussion" | "quotation_sent" | "closed";

export interface InternalNote {
  id: ID;
  author: string;
  text: string;
  createdAt: string;
}

export interface Rfq extends BaseEntity {
  reference: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  country: string;
  productOrCommodity: string;
  quantity: number;
  quantityUnit: string;
  targetPrice?: string;
  incoterm: string;
  deliveryPort: string;
  message: string;
  status: RfqStatus;
  assignedTo?: string;
  /** Set by the database-backed API; the mock identifies people by name only. */
  assignedToId?: string | null;
  notes: InternalNote[];
}

export type EnquiryStatus = "new" | "contacted" | "closed" | "spam";

export interface ContactEnquiry extends BaseEntity {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  subject: string;
  message: string;
  source: "Contact page" | "Footer form" | "Product page";
  status: EnquiryStatus;
  assignedTo?: string;
  assignedToId?: string | null;
  notes: InternalNote[];
}

export type ApplicationStatus = "new" | "screening" | "interview" | "offer" | "hired" | "rejected";

export interface JobApplication extends BaseEntity {
  careerId: ID;
  applicantName: string;
  email: string;
  phone: string;
  currentCompany?: string;
  experienceYears: number;
  coverNote: string;
  resumeFileName: string;
  resumeSizeBytes: number;
  status: ApplicationStatus;
  notes: InternalNote[];
}

export interface AdminUser extends BaseEntity {
  name: string;
  email: string;
  roleId: ID;
  status: "active" | "invited" | "suspended";
  lastLoginAt?: string | null;
  twoFactorEnabled: boolean;
}

export const PERMISSION_MODULES = [
  "products",
  "categories",
  "posts",
  "projects",
  "careers",
  "locations",
  "banners",
  "commodities",
  "trade",
  "enquiries",
  "applications",
  "media",
  "users",
  "settings",
] as const;
export type PermissionModule = (typeof PERMISSION_MODULES)[number];
export const PERMISSION_ACTIONS = ["view", "create", "edit", "delete", "publish"] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];
export type PermissionMatrix = Record<PermissionModule, PermissionAction[]>;

export interface Role extends BaseEntity {
  name: string;
  description: string;
  isSystem: boolean;
  permissions: PermissionMatrix;
}

export interface MediaAsset extends BaseEntity {
  name: string;
  kind: "image" | "video" | "other";
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  url: string;
  altText: string;
  uploadedBy: string;
  folder: string;
}

export interface DocumentFile extends BaseEntity {
  title: string;
  category: "Certificate" | "Policy" | "Brochure" | "Datasheet" | "Legal" | "Report";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  version: string;
  visibility: "public" | "internal";
  uploadedBy: string;
  status: PublishStatus;
}

export interface EmailTemplate extends BaseEntity {
  key: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  active: boolean;
}

export interface NotificationLog extends BaseEntity {
  templateKey: string;
  recipient: string;
  subject: string;
  status: "sent" | "failed" | "queued";
  error?: string;
}

export interface ActivityLog extends BaseEntity {
  actor: string;
  action: string;
  entityType: string;
  entityLabel: string;
  detail?: string;
}

export interface NavMenuItem {
  id: ID;
  label: string;
  href: string;
  visible: boolean;
  children: { id: ID; label: string; href: string }[];
}

export interface WebsiteSettings {
  general: {
    siteName: string;
    tagline: string;
    defaultLanguage: string;
    timezone: string;
    maintenanceMode: boolean;
  };
  navigation: NavMenuItem[];
  seo: {
    titleTemplate: string;
    defaultDescription: string;
    defaultOgImage: string;
    robotsIndex: boolean;
    googleSiteVerification: string;
  };
  contact: {
    primaryEmail: string;
    primaryPhone: string;
    address: string;
    socials: { linkedin: string; twitter: string; facebook: string; youtube: string };
  };
  footer: {
    aboutText: string;
    copyright: string;
    columns: { id: ID; title: string; links: { label: string; href: string }[] }[];
    showNewsletter: boolean;
  };
}
