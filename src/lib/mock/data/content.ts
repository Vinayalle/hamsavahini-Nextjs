import type { Banner, Career, Location, Post, Project } from "@/types/entities";
import { placeholderImage } from "./catalog";

const D = (d: string) => `2026-${d}T10:00:00.000Z`;
const seo = (t: string, d: string) => ({ metaTitle: `${t} | Hamsavahin`, metaDescription: d, keywords: [] as string[] });

const postRows: [string, Post["category"], string, Post["status"], string, string][] = [
  ["Aluminium Market Outlook: Q4 2026", "Market Insight", "Priya Menon", "published", "09-30", "Supply discipline in China and restocking in Europe shape the final quarter for primary aluminium."],
  ["Hamsavahin Opens Regional Office in Dubai", "Company News", "Rahul Varma", "published", "09-12", "The new Dubai office strengthens our Middle East and Africa trade desk."],
  ["Responsible Sourcing Report 2026", "Sustainability", "Anita Das", "published", "08-28", "Our annual report on supplier audits, traceability and emissions reduction."],
  ["Black Sea Wheat Corridor: Logistics Update", "Industry Report", "Priya Menon", "published", "08-05", "Port throughput and freight rates across the Black Sea grain corridor."],
  ["Understanding Incoterms 2020 for Bulk Cargo", "Industry Report", "Karthik Rao", "draft", "10-07", "A practical guide to FOB, CIF and DAP for bulk commodity buyers."],
  ["Urea Demand Ahead of the Rabi Season", "Market Insight", "Priya Menon", "draft", "10-09", "Import tenders and inventory levels point to firm demand through Q4."],
  ["Annual Safety Excellence Awards", "Company News", "Anita Das", "archived", "02-15", "Recognising teams across terminals and warehouses."],
  ["Copper Cathode Quality: What Buyers Should Check", "Market Insight", "Karthik Rao", "published", "07-19", "Key specifications and certificates to verify before accepting a cargo."],
];

export const postsSeed: Post[] = postRows.map(([title, category, author, status, upd, excerpt], i) => ({
  id: `pst_${String(i + 1).padStart(3, "0")}`,
  title,
  slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
  excerpt,
  content: `<p>${excerpt}</p><h2>Key points</h2><ul><li>Fundamentals and demand outlook</li><li>Logistics and freight considerations</li><li>What this means for buyers</li></ul><p>Contact the Hamsavahin trade desk for tailored guidance.</p>`,
  category,
  author,
  coverImage: placeholderImage(title.slice(0, 28), 200 + i * 15),
  tags: [category.toLowerCase(), "2026"],
  seo: seo(title, excerpt),
  status,
  publishedAt: status === "published" ? D(upd) : null,
  createdAt: D(upd),
  updatedAt: D(upd),
}));

const projRows: [string, string, string, string, Project["projectStatus"], Project["status"], boolean][] = [
  ["Bulk Aluminium Supply to a European Extruder", "Nordic Extrusions AS", "Aluminium", "Northern Europe", "active", "published", true],
  ["Coal Logistics for a South Asian Power Utility", "Eastern Power Corp", "Thermal Coal", "South Asia", "active", "published", true],
  ["Sunflower Oil Flexitank Programme", "GreenLeaf Foods", "Edible Oils", "Middle East", "completed", "published", false],
  ["Urea Import Programme for a Fertilizer Cooperative", "Kisan Agri Cooperative", "Urea", "South Asia", "completed", "published", false],
  ["Iron Ore Offtake Agreement", "Pacific Steelworks", "Iron Ore", "East Asia", "planning", "draft", false],
  ["Copper Cathode Strategic Stocking", "Meridian Cables", "Copper", "Africa", "on_hold", "draft", false],
];

export const projectsSeed: Project[] = projRows.map(([title, client, commodity, region, projectStatus, status, featured], i) => ({
  id: `prj_${String(i + 1).padStart(3, "0")}`,
  title,
  slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
  summary: `${commodity} trade programme for ${client} covering sourcing, inspection, shipping and delivery.`,
  content: `<p>End-to-end ${commodity.toLowerCase()} trade handled by the Hamsavahin team for ${client}.</p>`,
  client,
  commodity,
  region,
  startDate: `2026-0${(i % 6) + 1}-01`,
  endDate: projectStatus === "completed" ? `2026-0${(i % 6) + 4}-28` : null,
  projectStatus,
  status,
  featured,
  createdAt: D("03-01"),
  updatedAt: D(`0${(i % 3) + 7}-1${i}`),
}));

const careerRows: [string, string, string, Career["employmentType"], string, string, number, Career["status"]][] = [
  ["Senior Commodity Trader – Metals", "Trading", "Mumbai, India", "full_time", "8+ years", "2026-11-15", 2, "open"],
  ["Logistics & Shipping Manager", "Operations", "Dubai, UAE", "full_time", "6+ years", "2026-11-30", 1, "open"],
  ["Risk & Compliance Analyst", "Finance", "Singapore", "full_time", "3+ years", "2026-10-31", 1, "open"],
  ["Quality Inspection Coordinator", "Operations", "Rotterdam, Netherlands", "contract", "4+ years", "2026-12-10", 2, "draft"],
  ["Trade Finance Intern", "Finance", "Mumbai, India", "internship", "Fresher", "2026-09-30", 3, "closed"],
  ["Digital Marketing Specialist", "Marketing", "Remote", "part_time", "2+ years", "2026-11-20", 1, "open"],
];

export const careersSeed: Career[] = careerRows.map(([title, department, location, employmentType, experience, deadline, openings, status], i) => ({
  id: `car_${String(i + 1).padStart(3, "0")}`,
  title,
  slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
  department,
  location,
  employmentType,
  experience,
  description: `<p>Join Hamsavahin's ${department} team as ${title}. You will work with global counterparties across commodity markets.</p><ul><li>Own day-to-day workflows</li><li>Collaborate across regions</li></ul>`,
  requirements: `<ul><li>${experience} relevant experience</li><li>Strong written and verbal communication</li><li>Degree in business, engineering or a related field</li></ul>`,
  deadline,
  openings,
  status,
  createdAt: D("08-01"),
  updatedAt: D(`09-0${i + 1}`),
}));

const locRows: [string, Location["type"], string, string, string, boolean][] = [
  ["Hamsavahin Global Headquarters", "headquarters", "India", "Mumbai", "Level 21, Bandra Kurla Complex, Mumbai 400051", true],
  ["Middle East Regional Office", "regional_office", "UAE", "Dubai", "Office 1204, Jumeirah Lake Towers, Dubai", true],
  ["Europe Regional Office", "regional_office", "Netherlands", "Rotterdam", "Wilhelminakade 91, 3072 AP Rotterdam", true],
  ["Asia Pacific Office", "regional_office", "Singapore", "Singapore", "1 Raffles Quay, #24-01, Singapore 048583", true],
  ["Mundra Bulk Terminal", "port_terminal", "India", "Mundra", "Mundra Port & SEZ, Gujarat 370421", true],
  ["Jebel Ali Warehouse", "warehouse", "UAE", "Dubai", "Plot 598-210, Jebel Ali Free Zone", true],
  ["Lagos Representative Office", "representative", "Nigeria", "Lagos", "14 Adeola Odeku St, Victoria Island, Lagos", false],
];

export const locationsSeed: Location[] = locRows.map(([name, type, country, city, address, active], i) => ({
  id: `loc_${String(i + 1).padStart(3, "0")}`,
  name,
  type,
  country,
  city,
  address,
  phone: "+00 000 000 0000",
  email: `${city.toLowerCase().replace(/\s/g, "")}@example-hamsavahin.test`,
  active,
  createdAt: D("01-20"),
  updatedAt: D(`0${(i % 5) + 4}-1${i}`),
}));

export const bannersSeed: Banner[] = [
  { id: "ban_001", title: "Trusted Partner in Global Commodity Trade", subtitle: "Metals, energy, agriculture and chemicals — sourced responsibly, delivered reliably.", section: "hero", imageUrl: placeholderImage("Hero banner", 215), ctaLabel: "Explore Products", ctaUrl: "/products", sortOrder: 1, status: "published", startsAt: null, endsAt: null, createdAt: D("01-30"), updatedAt: D("09-01") },
  { id: "ban_002", title: "Request a Quote in 24 Hours", subtitle: "Share your requirement and our trade desk will respond within one business day.", section: "cta", imageUrl: placeholderImage("CTA banner", 150), ctaLabel: "Request a Quote", ctaUrl: "/rfq", sortOrder: 2, status: "published", startsAt: null, endsAt: null, createdAt: D("02-10"), updatedAt: D("08-15") },
  { id: "ban_003", title: "Now in Dubai", subtitle: "Our new Middle East office is open.", section: "promo", imageUrl: placeholderImage("Dubai office", 30), ctaLabel: "See Locations", ctaUrl: "/locations", sortOrder: 3, status: "published", startsAt: "2026-09-12", endsAt: "2026-12-31", createdAt: D("09-10"), updatedAt: D("09-12") },
  { id: "ban_004", title: "Sustainability Report 2026", subtitle: "Read how we are reducing the footprint of global trade.", section: "feature_strip", imageUrl: placeholderImage("Sustainability", 120), ctaLabel: "Read Report", ctaUrl: "/insights", sortOrder: 4, status: "draft", startsAt: null, endsAt: null, createdAt: D("10-01"), updatedAt: D("10-06") },
  { id: "ban_005", title: "Festive Season Notice", subtitle: "Trade desk hours during the holiday period.", section: "promo", ctaLabel: "Learn More", ctaUrl: "/contact", sortOrder: 5, status: "archived", startsAt: "2025-12-15", endsAt: "2026-01-05", createdAt: D("01-02"), updatedAt: D("01-06") },
];
