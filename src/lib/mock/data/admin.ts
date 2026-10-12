import {
  PERMISSION_ACTIONS, PERMISSION_MODULES,
  type ActivityLog, type AdminUser, type DocumentFile, type EmailTemplate, type MediaAsset,
  type NotificationLog, type PermissionAction, type PermissionMatrix, type Role, type WebsiteSettings,
} from "@/types/entities";
import { placeholderImage } from "./catalog";

const D = (d: string, t = "09:00") => `2026-${d}T${t}:00.000Z`;

function matrix(fill: (m: (typeof PERMISSION_MODULES)[number]) => PermissionAction[]): PermissionMatrix {
  return Object.fromEntries(PERMISSION_MODULES.map((m) => [m, fill(m)])) as PermissionMatrix;
}
const ALL = [...PERMISSION_ACTIONS];

export const rolesSeed: Role[] = [
  { id: "role_super", name: "Super Admin", description: "Full access to every module, including administration.", isSystem: true, permissions: matrix(() => ALL), createdAt: D("01-01"), updatedAt: D("01-01") },
  { id: "role_editor", name: "Content Editor", description: "Manage catalogue and content; cannot publish or administer users.", isSystem: false, permissions: matrix((m) => (["users", "settings"].includes(m) ? [] : ["view", "create", "edit"])), createdAt: D("01-10"), updatedAt: D("08-20") },
  { id: "role_trade", name: "Trade Desk", description: "Handle commodities, RFQs and enquiries.", isSystem: false, permissions: matrix((m) => (["commodities", "trade", "enquiries", "products"].includes(m) ? ["view", "create", "edit"] : m === "applications" ? [] : ["view"])), createdAt: D("01-10"), updatedAt: D("07-02") },
  { id: "role_hr", name: "HR Manager", description: "Manage careers and job applications.", isSystem: false, permissions: matrix((m) => (["careers", "applications"].includes(m) ? ["view", "create", "edit", "delete", "publish"] : [])), createdAt: D("02-01"), updatedAt: D("06-11") },
];

export const usersSeed: AdminUser[] = [
  { id: "usr_001", name: "Rahul Varma", email: "rahul.varma@example-hamsavahin.test", roleId: "role_super", status: "active", lastLoginAt: D("10-10", "08:42"), twoFactorEnabled: true, createdAt: D("01-01"), updatedAt: D("10-10") },
  { id: "usr_002", name: "Anita Das", email: "anita.das@example-hamsavahin.test", roleId: "role_editor", status: "active", lastLoginAt: D("10-09", "17:05"), twoFactorEnabled: true, createdAt: D("01-12"), updatedAt: D("10-09") },
  { id: "usr_003", name: "Priya Menon", email: "priya.menon@example-hamsavahin.test", roleId: "role_editor", status: "active", lastLoginAt: D("10-08", "11:30"), twoFactorEnabled: false, createdAt: D("02-03"), updatedAt: D("10-08") },
  { id: "usr_004", name: "Karthik Rao", email: "karthik.rao@example-hamsavahin.test", roleId: "role_trade", status: "active", lastLoginAt: D("10-07", "09:15"), twoFactorEnabled: true, createdAt: D("03-15"), updatedAt: D("10-07") },
  { id: "usr_005", name: "Meera Nair", email: "meera.nair@example-hamsavahin.test", roleId: "role_hr", status: "invited", lastLoginAt: null, twoFactorEnabled: false, createdAt: D("10-05"), updatedAt: D("10-05") },
  { id: "usr_006", name: "Sanjay Pillai", email: "sanjay.pillai@example-hamsavahin.test", roleId: "role_trade", status: "suspended", lastLoginAt: D("08-01"), twoFactorEnabled: false, createdAt: D("04-02"), updatedAt: D("09-01") },
];

const mediaRows: [string, MediaAsset["kind"], string, number, number, number, string][] = [
  ["hero-port-sunrise.jpg", "image", "image/jpeg", 1_840_000, 2400, 1200, "Banners"],
  ["terminal-aerial.jpg", "image", "image/jpeg", 2_210_000, 2400, 1600, "Locations"],
  ["aluminium-ingots.png", "image", "image/png", 960_000, 1600, 1200, "Products"],
  ["copper-cathode.png", "image", "image/png", 880_000, 1600, 1200, "Products"],
  ["team-dubai-office.jpg", "image", "image/jpeg", 1_430_000, 1800, 1200, "Posts"],
  ["urea-granules.jpg", "image", "image/jpeg", 740_000, 1500, 1000, "Products"],
  ["sunflower-oil.jpg", "image", "image/jpeg", 690_000, 1500, 1000, "Products"],
  ["coal-stockyard.jpg", "image", "image/jpeg", 1_120_000, 2000, 1333, "Projects"],
  ["company-intro.mp4", "video", "video/mp4", 18_400_000, 1920, 1080, "Banners"],
  ["logo-primary.png", "image", "image/png", 48_000, 800, 240, "Brand"],
  ["wheat-harvest.jpg", "image", "image/jpeg", 1_020_000, 1800, 1200, "Products"],
  ["iron-ore-pile.jpg", "image", "image/jpeg", 1_330_000, 2000, 1333, "Products"],
];

export const mediaSeed: MediaAsset[] = mediaRows.map(([name, kind, mimeType, sizeBytes, width, height, folder], i) => ({
  id: `med_${String(i + 1).padStart(3, "0")}`,
  name,
  kind,
  mimeType,
  sizeBytes,
  width,
  height,
  url: placeholderImage(name.replace(/\.[a-z0-9]+$/, ""), 190 + i * 12),
  altText: name.replace(/\.[a-z0-9]+$/, "").replace(/-/g, " "),
  uploadedBy: ["Anita Das", "Priya Menon", "Rahul Varma"][i % 3],
  folder,
  createdAt: D(`0${(i % 9) + 1}-1${i % 9}`),
  updatedAt: D(`0${(i % 9) + 1}-1${i % 9}`),
}));

const docRows: [string, DocumentFile["category"], string, string, DocumentFile["visibility"], DocumentFile["status"]][] = [
  ["ISO 9001:2015 Certificate", "Certificate", "iso-9001-2015.pdf", "2.1", "public", "published"],
  ["ISO 14001:2015 Certificate", "Certificate", "iso-14001-2015.pdf", "1.4", "public", "published"],
  ["Corporate Brochure 2026", "Brochure", "corporate-brochure-2026.pdf", "3.0", "public", "published"],
  ["Anti-Bribery & Corruption Policy", "Policy", "abc-policy.pdf", "2.0", "public", "published"],
  ["Supplier Code of Conduct", "Policy", "supplier-code.pdf", "1.2", "public", "published"],
  ["Standard Trading Terms", "Legal", "standard-terms-v5.pdf", "5.0", "internal", "published"],
  ["Annual Sustainability Report 2025", "Report", "sustainability-2025.pdf", "1.0", "public", "archived"],
  ["Urea 46% Datasheet", "Datasheet", "urea-46-datasheet.pdf", "1.1", "public", "draft"],
];

export const documentsSeed: DocumentFile[] = docRows.map(([title, category, fileName, version, visibility, status], i) => ({
  id: `doc_${String(i + 1).padStart(3, "0")}`,
  title,
  category,
  fileName,
  mimeType: "application/pdf",
  sizeBytes: 300_000 + i * 120_000,
  version,
  visibility,
  uploadedBy: ["Anita Das", "Rahul Varma"][i % 2],
  status,
  createdAt: D(`0${(i % 8) + 1}-05`),
  updatedAt: D(`0${(i % 8) + 1}-20`),
}));

export const templatesSeed: EmailTemplate[] = [
  { id: "tpl_001", key: "enquiry_ack", name: "Enquiry Acknowledgement", subject: "We received your enquiry – {{reference}}", body: "Dear {{name}},\n\nThank you for contacting Hamsavahin. Our team will respond within one business day.\n\nRegards,\nHamsavahin", variables: ["name", "reference"], active: true, createdAt: D("01-10"), updatedAt: D("08-01") },
  { id: "tpl_002", key: "rfq_received", name: "RFQ Received", subject: "Your RFQ {{reference}} has been received", body: "Dear {{name}},\n\nYour request for quotation for {{product}} is under review.\n\nRegards,\nTrade Desk", variables: ["name", "reference", "product"], active: true, createdAt: D("01-10"), updatedAt: D("07-15") },
  { id: "tpl_003", key: "application_ack", name: "Job Application Acknowledgement", subject: "Thanks for applying for {{role}}", body: "Dear {{name}},\n\nThank you for applying for {{role}}. We will be in touch if your profile matches.\n\nHR Team", variables: ["name", "role"], active: true, createdAt: D("01-12"), updatedAt: D("06-02") },
  { id: "tpl_004", key: "application_rejected", name: "Application Update – Not Proceeding", subject: "Update on your application for {{role}}", body: "Dear {{name}},\n\nThank you for your interest. We will not be moving forward at this time.\n\nHR Team", variables: ["name", "role"], active: false, createdAt: D("01-12"), updatedAt: D("06-02") },
  { id: "tpl_005", key: "admin_invite", name: "Admin Invitation", subject: "You have been invited to the Hamsavahin admin", body: "Hello {{name}},\n\nYou have been invited as {{role}}. Use the link to set up your account: {{link}}", variables: ["name", "role", "link"], active: true, createdAt: D("02-01"), updatedAt: D("10-05") },
];

const logRows: [string, string, NotificationLog["status"], string | undefined][] = [
  ["enquiry_ack", "marta.silva@example.test", "sent", undefined],
  ["rfq_received", "lena.hansen@example.test", "sent", undefined],
  ["application_ack", "rohan.desai@example.test", "sent", undefined],
  ["enquiry_ack", "daniel.brooks@example.test", "sent", undefined],
  ["admin_invite", "meera.nair@example-hamsavahin.test", "sent", undefined],
  ["rfq_received", "j.becker@example.test", "failed", "Mailbox unavailable (550)"],
  ["application_ack", "tomas.novak@example.test", "queued", undefined],
  ["enquiry_ack", "oluwaseun.adeyemi@example.test", "sent", undefined],
];

export const notificationLogsSeed: NotificationLog[] = logRows.map(([templateKey, recipient, status, error], i) => ({
  id: `ntf_${String(i + 1).padStart(3, "0")}`,
  templateKey,
  recipient,
  subject: templatesSeed.find((t) => t.key === templateKey)?.name ?? templateKey,
  status,
  error,
  createdAt: D(`10-0${(i % 9) + 1}`, "10:2" + (i % 10)),
  updatedAt: D(`10-0${(i % 9) + 1}`, "10:2" + (i % 10)),
}));

const actRows: [string, ActivityLog["action"], string, string, string?][] = [
  ["Rahul Varma", "login", "Session", "Rahul Varma signed in"],
  ["Anita Das", "published", "Post", "Aluminium Market Outlook: Q4 2026"],
  ["Priya Menon", "updated", "Product", "Diesel EN590 10ppm", "Updated specifications"],
  ["Karthik Rao", "created", "Commodity price", "Copper – 09 Oct 2026"],
  ["Anita Das", "created", "Product", "Bunker Fuel IFO 380"],
  ["Rahul Varma", "status_changed", "Career", "Trade Finance Intern", "Status → closed"],
  ["Rahul Varma", "created", "Admin user", "Meera Nair", "Invitation sent"],
  ["Priya Menon", "updated", "Project", "Coal Logistics for a South Asian Power Utility"],
  ["Anita Das", "archived", "Banner", "Festive Season Notice"],
  ["Karthik Rao", "status_changed", "RFQ", "RFQ-2026-1042", "Status → quoted"],
  ["Rahul Varma", "updated", "Role", "Trade Desk", "Permissions changed"],
  ["Anita Das", "deleted", "Media asset", "old-banner-draft.jpg"],
];

export const activitySeed: ActivityLog[] = actRows.map(([actor, action, entityType, entityLabel, detail], i) => ({
  id: `act_${String(i + 1).padStart(3, "0")}`,
  actor,
  action,
  entityType,
  entityLabel,
  detail,
  createdAt: D(`10-${String(10 - Math.floor(i / 2)).padStart(2, "0")}`, `${String(17 - i).padStart(2, "0")}:${(i * 7) % 60 < 10 ? "0" : ""}${(i * 7) % 60}`),
  updatedAt: D(`10-${String(10 - Math.floor(i / 2)).padStart(2, "0")}`, `${String(17 - i).padStart(2, "0")}:00`),
}));

export const settingsSeed: WebsiteSettings = {
  general: {
    siteName: "Hamsavahin",
    tagline: "Global industrial & commodities partner",
    defaultLanguage: "en",
    timezone: "Asia/Kolkata",
    maintenanceMode: false,
  },
  navigation: [
    { id: "nav_1", label: "Home", href: "/", visible: true, children: [] },
    { id: "nav_2", label: "Products", href: "/products", visible: true, children: [
      { id: "nav_2a", label: "Metals & Alloys", href: "/products/metals-alloys" },
      { id: "nav_2b", label: "Energy & Fuels", href: "/products/energy-fuels" },
    ] },
    { id: "nav_3", label: "Insights", href: "/insights", visible: true, children: [] },
    { id: "nav_4", label: "Projects", href: "/projects", visible: true, children: [] },
    { id: "nav_5", label: "Careers", href: "/careers", visible: true, children: [] },
    { id: "nav_6", label: "Contact", href: "/contact", visible: true, children: [] },
  ],
  seo: {
    titleTemplate: "%s | Hamsavahin",
    defaultDescription: "Hamsavahin is a global industrial and commodities company supplying metals, energy, agriculture and chemicals.",
    defaultOgImage: "",
    robotsIndex: true,
    googleSiteVerification: "",
  },
  contact: {
    primaryEmail: "info@example-hamsavahin.test",
    primaryPhone: "+00 000 000 0000",
    address: "Level 21, Bandra Kurla Complex, Mumbai 400051, India",
    socials: { linkedin: "https://linkedin.com/company/example", twitter: "", facebook: "", youtube: "" },
  },
  footer: {
    aboutText: "Hamsavahin connects producers and buyers across metals, energy, agriculture and chemicals.",
    copyright: "© 2026 Hamsavahin. All rights reserved.",
    columns: [
      { id: "fc_1", title: "Company", links: [{ label: "About", href: "/about" }, { label: "Careers", href: "/careers" }] },
      { id: "fc_2", title: "Trade", links: [{ label: "Products", href: "/products" }, { label: "Request a Quote", href: "/rfq" }] },
    ],
    showNewsletter: false,
  },
};
