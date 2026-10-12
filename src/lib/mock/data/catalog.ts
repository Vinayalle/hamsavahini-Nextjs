import type { Category, Product, ProductSpec } from "@/types/entities";

/** Inline SVG placeholder so mock data needs no external assets. */
export function placeholderImage(label: string, hue = 215): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 40% 88%)"/><stop offset="1" stop-color="hsl(${hue} 45% 74%)"/></linearGradient></defs><rect width="640" height="480" fill="url(#g)"/><text x="320" y="250" font-family="Arial,sans-serif" font-size="30" fill="hsl(${hue} 45% 28%)" text-anchor="middle">${label.replace(/&/g, "and")}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const D = (d: string) => `2026-${d}T09:30:00.000Z`;

export const categoriesSeed: Category[] = [
  { id: "cat_energy", name: "Energy & Fuels", slug: "energy-fuels", description: "Refined petroleum products, coal and bunker fuels.", parentId: null, sortOrder: 1, status: "published", createdAt: D("01-12"), updatedAt: D("08-14") },
  { id: "cat_metals", name: "Metals & Alloys", slug: "metals-alloys", description: "Ferrous and non-ferrous metals, ingots and scrap.", parentId: null, sortOrder: 2, status: "published", createdAt: D("01-12"), updatedAt: D("09-02") },
  { id: "cat_agri", name: "Agricultural Commodities", slug: "agricultural-commodities", description: "Grains, oilseeds, edible oils and sugar.", parentId: null, sortOrder: 3, status: "published", createdAt: D("01-14"), updatedAt: D("09-18") },
  { id: "cat_chem", name: "Industrial Chemicals", slug: "industrial-chemicals", description: "Base chemicals, solvents and fertilizer inputs.", parentId: null, sortOrder: 4, status: "published", createdAt: D("02-03"), updatedAt: D("07-21") },
  { id: "cat_minerals", name: "Minerals & Ores", slug: "minerals-ores", description: "Iron ore, bauxite, manganese and industrial minerals.", parentId: null, sortOrder: 5, status: "published", createdAt: D("02-03"), updatedAt: D("06-30") },
  { id: "cat_packaging", name: "Packaging Materials", slug: "packaging-materials", description: "Industrial packaging and bulk containers (under review).", parentId: null, sortOrder: 6, status: "draft", createdAt: D("08-20"), updatedAt: D("09-25") },
];

const spec = (id: string, label: string, value: string, unit?: string): ProductSpec => ({ id, label, value, unit });

interface P {
  id: string; name: string; code: string; cat: string; short: string; hue: number;
  status: Product["status"]; featured: boolean; updated: string; specs: ProductSpec[];
}

const rows: P[] = [
  { id: "prd_001", name: "Aluminium Ingot A7", code: "HMV-MET-1001", cat: "cat_metals", short: "99.7% purity primary aluminium ingots for extrusion and casting.", hue: 210, status: "published", featured: true, updated: "10-02", specs: [spec("s1", "Purity", "99.7", "%"), spec("s2", "Ingot weight", "22", "kg"), spec("s3", "Standard", "EN 576")] },
  { id: "prd_002", name: "Copper Cathode Grade A", code: "HMV-MET-1002", cat: "cat_metals", short: "LME Grade A copper cathodes, 99.99% Cu.", hue: 22, status: "published", featured: true, updated: "09-29", specs: [spec("s1", "Copper content", "99.99", "%"), spec("s2", "Sheet size", "1000x1000", "mm"), spec("s3", "Standard", "BS EN 1978")] },
  { id: "prd_003", name: "Steel Billets 130mm", code: "HMV-MET-1003", cat: "cat_metals", short: "Continuous-cast billets for rebar and wire-rod rolling.", hue: 200, status: "published", featured: false, updated: "09-14", specs: [spec("s1", "Section", "130x130", "mm"), spec("s2", "Length", "12", "m"), spec("s3", "Grade", "Q235 / 5SP")] },
  { id: "prd_004", name: "Diesel EN590 10ppm", code: "HMV-ENG-2001", cat: "cat_energy", short: "Ultra-low sulphur diesel conforming to EN590.", hue: 38, status: "published", featured: true, updated: "10-05", specs: [spec("s1", "Sulphur", "10", "ppm max"), spec("s2", "Cetane number", "51", "min"), spec("s3", "Density @15°C", "820-845", "kg/m³")] },
  { id: "prd_005", name: "Thermal Coal 5500 NAR", code: "HMV-ENG-2002", cat: "cat_energy", short: "Steam coal for power generation, 5,500 kcal/kg NAR.", hue: 220, status: "published", featured: false, updated: "08-30", specs: [spec("s1", "Calorific value", "5500", "kcal/kg NAR"), spec("s2", "Total moisture", "16", "% max"), spec("s3", "Ash", "14", "% max")] },
  { id: "prd_006", name: "Bunker Fuel IFO 380", code: "HMV-ENG-2003", cat: "cat_energy", short: "Intermediate fuel oil for marine engines, ISO 8217.", hue: 30, status: "draft", featured: false, updated: "10-08", specs: [spec("s1", "Viscosity @50°C", "380", "cSt max"), spec("s2", "Sulphur", "3.5", "% max")] },
  { id: "prd_007", name: "Refined Sunflower Oil", code: "HMV-AGR-3001", cat: "cat_agri", short: "Refined, bleached and deodorised sunflower oil, bulk.", hue: 48, status: "published", featured: true, updated: "09-21", specs: [spec("s1", "Free fatty acid", "0.1", "% max"), spec("s2", "Moisture", "0.1", "% max"), spec("s3", "Packing", "Flexitank / bulk")] },
  { id: "prd_008", name: "White Crystal Sugar ICUMSA 45", code: "HMV-AGR-3002", cat: "cat_agri", short: "Refined white sugar, ICUMSA 45 max, 50 kg bags.", hue: 190, status: "published", featured: false, updated: "09-09", specs: [spec("s1", "ICUMSA", "45", "max"), spec("s2", "Polarisation", "99.8", "% min"), spec("s3", "Packing", "50", "kg bags")] },
  { id: "prd_009", name: "Milling Wheat 12.5% Protein", code: "HMV-AGR-3003", cat: "cat_agri", short: "Bulk milling wheat, Black Sea origin.", hue: 42, status: "draft", featured: false, updated: "10-09", specs: [spec("s1", "Protein", "12.5", "% min"), spec("s2", "Test weight", "76", "kg/hl min")] },
  { id: "prd_010", name: "Caustic Soda Flakes 99%", code: "HMV-CHM-4001", cat: "cat_chem", short: "Sodium hydroxide flakes for alumina and textile industries.", hue: 170, status: "published", featured: false, updated: "08-12", specs: [spec("s1", "NaOH", "99", "% min"), spec("s2", "Packing", "25", "kg bags")] },
  { id: "prd_011", name: "Urea 46% Granular", code: "HMV-CHM-4002", cat: "cat_chem", short: "Granular urea fertilizer, 46% nitrogen.", hue: 140, status: "published", featured: true, updated: "09-27", specs: [spec("s1", "Nitrogen", "46", "% min"), spec("s2", "Biuret", "1.0", "% max"), spec("s3", "Granule size", "2-4", "mm")] },
  { id: "prd_012", name: "Iron Ore Fines 62% Fe", code: "HMV-MIN-5001", cat: "cat_minerals", short: "Seaborne iron ore fines, 62% Fe benchmark grade.", hue: 12, status: "published", featured: false, updated: "07-18", specs: [spec("s1", "Fe content", "62", "% min"), spec("s2", "Silica", "4.5", "% max"), spec("s3", "Moisture", "8", "% max")] },
  { id: "prd_013", name: "Bauxite Metallurgical Grade", code: "HMV-MIN-5002", cat: "cat_minerals", short: "Metallurgical grade bauxite for alumina refineries.", hue: 5, status: "draft", featured: false, updated: "10-01", specs: [spec("s1", "Al2O3", "48", "% min"), spec("s2", "SiO2", "6", "% max")] },
  { id: "prd_014", name: "Zinc Ingot SHG 99.995%", code: "HMV-MET-1004", cat: "cat_metals", short: "Special high grade zinc ingots.", hue: 230, status: "archived", featured: false, updated: "05-02", specs: [spec("s1", "Zn", "99.995", "% min")] },
];

export const productsSeed: Product[] = rows.map((r, i) => ({
  id: r.id,
  name: r.name,
  slug: r.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
  code: r.code,
  categoryId: r.cat,
  shortDescription: r.short,
  description: `${r.short}\n\nSupplied against international specifications with independent inspection at load port. Contact our trade desk for volumes, delivery terms and certificates of analysis.`,
  images: [
    { id: `${r.id}_i1`, url: placeholderImage(r.name, r.hue), alt: `${r.name} main view`, isPrimary: true },
    { id: `${r.id}_i2`, url: placeholderImage(`${r.name} - detail`, r.hue + 15), alt: `${r.name} detail`, isPrimary: false },
  ],
  specifications: r.specs,
  documents: r.status === "draft" ? [] : [
    { id: `${r.id}_d1`, name: `${r.code}-datasheet.pdf`, type: "datasheet", sizeBytes: 240_000 + i * 17_000 },
    { id: `${r.id}_d2`, name: `${r.code}-coa-sample.pdf`, type: "coa", sizeBytes: 180_000 + i * 9_000 },
  ],
  seo: {
    metaTitle: `${r.name} | Hamsavahin`,
    metaDescription: r.short,
    keywords: [r.name.toLowerCase(), "bulk supply", "commodity trading"],
  },
  status: r.status,
  featured: r.featured,
  publishedAt: r.status === "published" ? D("03-10") : null,
  createdAt: D("02-20"),
  updatedAt: D(r.updated),
}));
