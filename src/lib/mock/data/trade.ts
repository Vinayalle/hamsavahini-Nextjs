import type {
  Commodity, CommodityPrice, ContactEnquiry, JobApplication, Rfq, TradeOpportunity,
} from "@/types/entities";

const D = (d: string, t = "11:00") => `2026-${d}T${t}:00.000Z`;

const comm: [string, string, Commodity["group"], string, Commodity["status"]][] = [
  ["Aluminium", "ALU", "Metals", "MT", "published"],
  ["Copper", "CU", "Metals", "MT", "published"],
  ["Zinc", "ZN", "Metals", "MT", "published"],
  ["Thermal Coal", "COAL", "Energy", "MT", "published"],
  ["Diesel", "ULSD", "Energy", "MT", "published"],
  ["Sunflower Oil", "SFO", "Agriculture", "MT", "published"],
  ["Raw Sugar", "SUG", "Agriculture", "MT", "published"],
  ["Urea", "UREA", "Chemicals", "MT", "published"],
  ["Iron Ore 62% Fe", "IORE", "Minerals", "DMT", "published"],
  ["Bauxite", "BXT", "Minerals", "DMT", "draft"],
];

export const commoditiesSeed: Commodity[] = comm.map(([name, code, group, unit, status], i) => ({
  id: `com_${String(i + 1).padStart(3, "0")}`,
  name,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
  code,
  group,
  unit,
  description: `${name} traded by Hamsavahin under spot and term contracts.`,
  status,
  createdAt: D("01-15"),
  updatedAt: D(`0${(i % 4) + 6}-0${(i % 8) + 1}`),
}));

/** Prices are manually entered by editors (no live feed in this phase). */
const basePrices: Record<string, [number, string]> = {
  com_001: [2480, "LME official, Cash"],
  com_002: [9420, "LME official, Cash"],
  com_003: [2890, "LME official, Cash"],
  com_004: [118, "API2 CIF ARA"],
  com_005: [715, "Platts CIF NWE"],
  com_006: [1240, "FOB Black Sea"],
  com_007: [520, "Spot, London No.5"],
  com_008: [405, "FOB Middle East"],
  com_009: [104, "CFR China, 62% Fe"],
};

export const commodityPricesSeed: CommodityPrice[] = Object.entries(basePrices).flatMap(([cid, [price, market]], i) =>
  [0, 1].map((k) => ({
    id: `prc_${cid.slice(-3)}_${k}`,
    commodityId: cid,
    price: Math.round(price * (k === 0 ? 1 : 0.985)),
    currency: "USD" as const,
    unit: "MT",
    market,
    effectiveDate: k === 0 ? "2026-10-09" : "2026-10-02",
    status: (i === 8 && k === 0 ? "draft" : "published") as "draft" | "published",
    createdAt: D("10-02"),
    updatedAt: D(k === 0 ? "10-09" : "10-02"),
  })),
);

export const opportunitiesSeed: TradeOpportunity[] = [
  { id: "opp_001", title: "Seeking 5,000 MT Copper Cathode – Q1 2027", commodityId: "com_002", type: "buy", quantity: "5,000 MT", originRegion: "Chile / Peru", destinationRegion: "East Asia", incoterm: "CIF", validUntil: "2026-12-15", description: "Term contract, monthly shipments of 1,000 MT.", status: "requirement_open", category: "buying_requirement", createdAt: D("09-20"), updatedAt: D("10-04") },
  { id: "opp_002", title: "Offer: 20,000 MT Urea 46% Granular", commodityId: "com_008", type: "sell", quantity: "20,000 MT", originRegion: "Middle East", destinationRegion: "South Asia", incoterm: "FOB", validUntil: "2026-11-20", description: "Prompt shipment, 10% tolerance.", status: "available", category: "available_for_sale", createdAt: D("09-25"), updatedAt: D("10-01") },
  { id: "opp_003", title: "Thermal Coal 5500 NAR – Spot Cargo", commodityId: "com_004", type: "sell", quantity: "60,000 MT", originRegion: "Indonesia", destinationRegion: "India", incoterm: "FOB", validUntil: "2026-10-31", description: "Panamax cargo available laycan 15–25 Nov.", status: "under_negotiation", category: "spot", createdAt: D("10-02"), updatedAt: D("10-08") },
  { id: "opp_004", title: "Sunflower Oil Flexitank Demand – GCC", commodityId: "com_006", type: "buy", quantity: "2,400 MT", originRegion: "Black Sea", destinationRegion: "GCC", incoterm: "CFR", validUntil: "2026-11-05", description: "Refined oil, 24 flexitanks.", status: "draft", category: "active_enquiry", createdAt: D("10-06"), updatedAt: D("10-06") },
  { id: "opp_005", title: "Aluminium Ingot A7 Tender", commodityId: "com_001", type: "buy", quantity: "3,000 MT", originRegion: "Global", destinationRegion: "Europe", incoterm: "DAP", validUntil: "2026-09-30", description: "Annual contract tender – closed.", status: "closed", category: "buying_requirement", createdAt: D("08-12"), updatedAt: D("09-30") },
];

const rfqRows: [string, string, string, string, number, Rfq["status"], string][] = [
  ["Nordic Extrusions AS", "Aluminium Ingot A7", "Norway", "MT", 1200, "new", "Lena Hansen"],
  ["Meridian Cables Ltd", "Copper Cathode Grade A", "Kenya", "MT", 800, "contacted", "Peter Otieno"],
  ["Eastern Power Corp", "Thermal Coal 5500 NAR", "Bangladesh", "MT", 55000, "quotation_sent", "Md. Rahman"],
  ["GreenLeaf Foods", "Refined Sunflower Oil", "Saudi Arabia", "MT", 2400, "under_discussion", "Omar Al-Said"],
  ["Kisan Agri Cooperative", "Urea 46% Granular", "India", "MT", 25000, "closed", "S. Iyer"],
  ["Pacific Steelworks", "Iron Ore Fines 62% Fe", "Japan", "DMT", 150000, "closed", "H. Tanaka"],
  ["Atlas Chemicals GmbH", "Caustic Soda Flakes 99%", "Germany", "MT", 600, "new", "J. Becker"],
  ["Sahara Mills", "Milling Wheat 12.5%", "Egypt", "MT", 30000, "contacted", "A. Fathy"],
];

export const rfqsSeed: Rfq[] = rfqRows.map(([companyName, productOrCommodity, country, quantityUnit, quantity, status, contactName], i) => ({
  id: `rfq_${String(i + 1).padStart(3, "0")}`,
  reference: `RFQ-2026-${String(1040 + i)}`,
  companyName,
  contactName,
  email: `${contactName.toLowerCase().replace(/[^a-z]+/g, ".")}@example.test`,
  phone: "+00 000 000 0000",
  country,
  productOrCommodity,
  quantity,
  quantityUnit,
  targetPrice: i % 2 === 0 ? "To be discussed" : undefined,
  incoterm: ["CIF", "FOB", "CFR", "DAP"][i % 4],
  deliveryPort: ["Rotterdam", "Mombasa", "Chittagong", "Jeddah", "Nhava Sheva", "Yokohama", "Hamburg", "Alexandria"][i],
  message: `We would like a competitive quotation for ${quantity.toLocaleString("en-US")} ${quantityUnit} of ${productOrCommodity}, with delivery in the next 60 days.`,
  status,
  assignedTo: status === "new" ? undefined : "Rahul Varma",
  notes: status === "new" ? [] : [{ id: `n_${i}`, author: "Rahul Varma", text: "Initial review done; awaiting specs confirmation.", createdAt: D("10-0" + ((i % 8) + 1)) }],
  createdAt: D(`10-0${(i % 8) + 1}`, "08:20"),
  updatedAt: D(`10-0${(i % 8) + 1}`, "15:40"),
}));

const enqRows: [string, string, string, ContactEnquiry["status"]][] = [
  ["Marta Silva", "Partnership enquiry", "Our firm would like to discuss a distribution partnership in Brazil.", "new"],
  ["Daniel Brooks", "Request for company profile", "Please share your corporate brochure and certifications.", "new"],
  ["Fatima Khan", "Sample request – Urea", "We need samples for lab testing before placing a trial order.", "contacted"],
  ["Chen Wei", "Port handling capability", "Does Hamsavahin offer bulk handling at Mundra?", "contacted"],
  ["Oluwaseun Adeyemi", "Supplier registration", "How can we register as an approved supplier?", "new"],
  ["Ivan Petrov", "Invoice query", "Question regarding invoice INV-88231.", "closed"],
  ["Sofia Rossi", "Media enquiry", "Requesting a comment for an upcoming industry article.", "closed"],
  ["win big now", "You have won", "Click here to claim your prize.", "spam"],
  ["Ahmed Al-Farsi", "Storage availability", "Do you have warehouse capacity at Jebel Ali for 3 months?", "new"],
  ["Emma Johansson", "Sustainability data", "We need your emissions data for supplier assessment.", "contacted"],
];

export const enquiriesSeed: ContactEnquiry[] = enqRows.map(([name, subject, message, status], i) => ({
  id: `enq_${String(i + 1).padStart(3, "0")}`,
  name,
  email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.test`,
  phone: i % 3 === 0 ? "+00 000 000 0000" : undefined,
  company: i % 2 === 0 ? "Independent / Private" : undefined,
  subject,
  message,
  source: (["Contact page", "Footer form", "Product page"] as const)[i % 3],
  status,
  assignedTo: status === "contacted" || status === "closed" ? "Anita Das" : undefined,
  notes: [],
  createdAt: D(`10-${String(10 - Math.min(i, 9)).padStart(2, "0")}`, "10:15"),
  updatedAt: D(`10-${String(10 - Math.min(i, 9)).padStart(2, "0")}`, "10:15"),
}));

const appRows: [string, string, number, JobApplication["status"]][] = [
  ["Aarav Mehta", "car_001", 9, "interview"],
  ["Sneha Kulkarni", "car_001", 7, "screening"],
  ["Rohan Desai", "car_001", 11, "new"],
  ["Layla Haddad", "car_002", 8, "offer"],
  ["Tomas Novak", "car_002", 5, "new"],
  ["Mei Lin Tan", "car_003", 4, "screening"],
  ["Vikram Shah", "car_003", 3, "rejected"],
  ["Nisha Pillai", "car_006", 3, "new"],
  ["Kabir Anand", "car_005", 0, "hired"],
  ["Hana Suzuki", "car_006", 2, "interview"],
];

export const applicationsSeed: JobApplication[] = appRows.map(([applicantName, careerId, experienceYears, status], i) => ({
  id: `app_${String(i + 1).padStart(3, "0")}`,
  careerId,
  applicantName,
  email: `${applicantName.toLowerCase().replace(/[^a-z]+/g, ".")}@example.test`,
  phone: "+00 000 000 0000",
  currentCompany: experienceYears ? "Confidential" : undefined,
  experienceYears,
  coverNote: "I am excited by the opportunity to contribute to Hamsavahin's global trade operations.",
  resumeFileName: `${applicantName.replace(/\s+/g, "_")}_Resume.pdf`,
  resumeSizeBytes: 180_000 + i * 31_000,
  status,
  notes: [],
  createdAt: D(`10-0${(i % 9) + 1}`, "13:05"),
  updatedAt: D(`10-0${(i % 9) + 1}`, "13:05"),
}));
