import type { IconType } from "react-icons";
import {
  LuAtom, LuAward, LuBadgeCheck, LuBrickWall, LuBuilding2, LuCircleCheck, LuClock, LuEye, LuFactory, LuFileCheck2, LuFlame, LuFlaskConical,
  LuGem, LuGlassWater, LuGlobe, LuHandshake, LuLayers, LuLeaf, LuChartLine, LuMountain, LuPickaxe, LuScale, LuShieldCheck, LuShip, LuZap,
} from "react-icons/lu";

/**
 * Written content of the public website that does not come from the admin CMS.
 * It is descriptive and general: it makes no claims about the company's size, years in business, certificates, volumes or addresses.
 * (Those belong in the admin: Settings -> Contact / Footer, and the products, locations and posts modules.)
 */
export const COMPANY = {
  name: "Hamsavahin Aarth Mines",
  short: "Hamsavahin",
  tagline: "Your global gateway to minerals.",
  description:
    "Hamsavahin Aarth Mines is a global sourcing and trading company connecting trusted mineral producers with industries that demand excellence and reliability.",
};

/* ───────────── Minerals ───────────── */
export interface Mineral {
  slug: string;
  name: string;
  icon: IconType;
  /** One line for cards and menus. */
  short: string;
  intro: string;
  /** What it is used for, in plain terms. */
  uses: string[];
  industries: string[];
  /** How we handle it: sourcing, specification and documents (process, not claims). */
  handling: { title: string; text: string }[];
  /** Questions a buyer typically asks before an enquiry. */
  buyerNotes: string[];
}

const handlingDefaults = (what: string): Mineral["handling"] => [
  { title: "Sourced at the mine", text: `We work with verified producers and agree the ${what} specification with you before a consignment is arranged.` },
  { title: "Tested and documented", text: "Each shipment is tested against the agreed specification, with a certificate of analysis and clear shipping documents." },
  { title: "Delivered to your port", text: "We coordinate warehousing, loading, shipping and customs so the material reaches you on the agreed schedule." },
];

export const MINERALS: Mineral[] = [
  {
    slug: "iron-ore-fines",
    name: "Iron Ore & Fines",
    icon: LuMountain,
    short: "The main raw material of steelmaking, supplied as lumps and fines.",
    intro:
      "Iron ore is the starting point of the steel industry. It is supplied as lump ore, fines or feed for pelletising, and the right grade depends on the furnace, the sinter plant and the process it feeds.",
    uses: ["Blast furnace and direct-reduction steelmaking", "Sinter and pellet plant feed", "Pig iron and cast iron production", "Heavy-media separation and weighting material"],
    industries: ["steel-metallurgy", "construction-infrastructure", "industrial-manufacturing"],
    handling: handlingDefaults("iron content and size"),
    buyerNotes: ["Iron content, moisture and size range of the material you need", "Lump, fines or pellet feed", "Quantity per shipment and loading port"],
  },
  {
    slug: "quartz-silica-minerals",
    name: "Quartz & Silica Minerals",
    icon: LuGem,
    short: "High-purity silica for glass, ceramics, foundry and silicon.",
    intro:
      "Quartz and silica minerals are valued for purity and consistency. Small differences in chemistry and grain size decide whether a lot suits glass making, foundry sand or silicon production.",
    uses: ["Glass and fibreglass manufacturing", "Ceramics, tiles and sanitaryware", "Foundry moulds and filtration media", "Silicon metal and ferrosilicon"],
    industries: ["glass-ceramics", "steel-metallurgy", "industrial-manufacturing"],
    handling: handlingDefaults("purity and grain size"),
    buyerNotes: ["Required silica content and permitted impurities", "Lump or graded and sized material", "Packaging: bulk or bags"],
  },
  {
    slug: "bauxite-laterite",
    name: "Bauxite & Laterite",
    icon: LuLayers,
    short: "The ore behind aluminium, with laterite for cement and refractories.",
    intro:
      "Bauxite is the principal ore of aluminium, refined to alumina before smelting. Laterite and related materials also serve cement, refractory and chemical uses.",
    uses: ["Alumina and aluminium production", "Refractory materials", "Cement and construction materials", "Abrasives and chemicals"],
    industries: ["steel-metallurgy", "construction-infrastructure", "industrial-manufacturing"],
    handling: handlingDefaults("alumina and silica"),
    buyerNotes: ["Alumina and reactive silica requirements", "Moisture and size", "Shipment size and delivery window"],
  },
  {
    slug: "manganese-ore",
    name: "Manganese Ore",
    icon: LuAtom,
    short: "An essential alloying and deoxidising element for steel.",
    intro:
      "Manganese gives steel strength and toughness and removes oxygen and sulphur during steelmaking. Most manganese ore is smelted into ferroalloys before it reaches the steel plant.",
    uses: ["Ferromanganese and silicomanganese alloys", "Steel strengthening and deoxidation", "Dry-cell battery materials", "Pigments and chemicals"],
    industries: ["steel-metallurgy", "power-energy", "industrial-manufacturing"],
    handling: handlingDefaults("manganese content"),
    buyerNotes: ["Manganese content and iron, phosphorus and silica limits", "Lump or fines", "Annual or spot requirement"],
  },
  {
    slug: "granite-dimension-stones",
    name: "Granite & Dimension Stones",
    icon: LuBrickWall,
    short: "Natural stone for building, paving, monuments and interiors.",
    intro:
      "Granite and dimension stones are chosen for strength, finish and colour. They are supplied as blocks, slabs or cut-to-size pieces for projects where durability and appearance both matter.",
    uses: ["Building facades, flooring and cladding", "Kitchen and bathroom worktops", "Paving, kerbs and landscaping", "Memorials and monuments"],
    industries: ["construction-infrastructure"],
    handling: handlingDefaults("colour, finish and dimension"),
    buyerNotes: ["Colour, finish and thickness", "Blocks, slabs or cut-to-size", "Samples before a larger order"],
  },
  {
    slug: "industrial-specialty-minerals",
    name: "Industrial & Specialty Minerals",
    icon: LuFlaskConical,
    short: "Functional minerals for ceramics, coatings, plastics and more.",
    intro:
      "Specialty minerals are bought for what they do: whiteness, hardness, heat resistance or chemical behaviour. Because each application is specific, we work from your specification rather than a fixed list.",
    uses: ["Ceramics, glazes and glass", "Paints, coatings and plastics fillers", "Drilling and oilfield materials", "Electrical and refractory applications"],
    industries: ["glass-ceramics", "power-energy", "industrial-manufacturing"],
    handling: handlingDefaults("grade and particle size"),
    buyerNotes: ["The mineral and the grade you are looking for", "Particle size and packaging", "Your end use, so we can match the right source"],
  },
];

export const mineralBySlug = (slug: string) => MINERALS.find((m) => m.slug === slug);

/* ───────────── Industries ───────────── */
export interface Industry {
  slug: string;
  name: string;
  icon: IconType;
  summary: string;
  needs: string[];
  minerals: string[];
}

export const INDUSTRIES: Industry[] = [
  {
    slug: "steel-metallurgy",
    name: "Steel & Metallurgy",
    icon: LuFlame,
    summary: "Steel plants, foundries and ferroalloy makers depend on a steady, consistent supply of ore and alloying minerals.",
    needs: ["Consistent chemistry from lot to lot", "Reliable shipment schedules", "Full test and shipping documentation"],
    minerals: ["iron-ore-fines", "manganese-ore", "bauxite-laterite", "quartz-silica-minerals"],
  },
  {
    slug: "glass-ceramics",
    name: "Glass & Ceramics",
    icon: LuGlassWater,
    summary: "Glass and ceramic makers need clean, well-graded raw materials where colour and purity matter.",
    needs: ["Controlled impurities and colour", "Defined particle size", "Traceable origin and test results"],
    minerals: ["quartz-silica-minerals", "industrial-specialty-minerals"],
  },
  {
    slug: "construction-infrastructure",
    name: "Construction & Infrastructure",
    icon: LuBuilding2,
    summary: "Building and infrastructure projects use natural stone, aggregates and cement raw materials in large volumes.",
    needs: ["Material that meets the project specification", "Volume supply on a project timeline", "Consistent finish across batches"],
    minerals: ["granite-dimension-stones", "iron-ore-fines", "bauxite-laterite"],
  },
  {
    slug: "power-energy",
    name: "Power & Energy",
    icon: LuZap,
    summary: "Energy and electrical sectors rely on minerals for batteries, insulation, drilling and heat-resistant components.",
    needs: ["Application-specific grades", "Documented quality", "Dependable long-term supply"],
    minerals: ["manganese-ore", "industrial-specialty-minerals"],
  },
  {
    slug: "industrial-manufacturing",
    name: "Industrial Manufacturing",
    icon: LuFactory,
    summary: "Manufacturers of machinery, coatings, plastics and components buy minerals as inputs to everyday products.",
    needs: ["Specification-led sourcing", "Flexible order sizes", "A single partner for several materials"],
    minerals: ["industrial-specialty-minerals", "quartz-silica-minerals", "iron-ore-fines", "bauxite-laterite"],
  },
];
export const industryBySlug = (slug: string) => INDUSTRIES.find((i) => i.slug === slug);

/* ───────────── What we do / why us (from the About page content) ───────────── */
export interface Point { title: string; text: string; icon: IconType }

export const CAPABILITIES: Point[] = [
  { title: "Global Mineral Sourcing", icon: LuPickaxe, text: "We source high-grade minerals directly from verified mines and producers, ensuring purity, consistency, and commercial value for every consignment." },
  { title: "Quality & Certification", icon: LuBadgeCheck, text: "Each shipment is tested and certified to international standards, with full traceability and transparent documentation." },
  { title: "End-to-End Logistics", icon: LuShip, text: "From mine to port, we manage the entire supply chain — including warehousing, shipping, and customs — ensuring smooth and timely delivery." },
  { title: "Long-Term Supply Partnerships", icon: LuHandshake, text: "We work closely with industrial clients to establish dependable sourcing strategies and long-term contracts that ensure production continuity." },
  { title: "Market Intelligence", icon: LuChartLine, text: "Our team provides actionable insights into market trends, price movements, and demand forecasts to support informed procurement decisions." },
];

export const WHY_US: Point[] = [
  { title: "Global reach with local expertise", icon: LuGlobe, text: "Producers and buyers in many regions, handled by a team that understands each market." },
  { title: "Proven track record of reliability", icon: LuShieldCheck, text: "Consistent quality and on-time supply, consignment after consignment." },
  { title: "Ethical and transparent operations", icon: LuScale, text: "Clear terms, clear documents and open communication at every step." },
  { title: "Quality assurance at every stage", icon: LuBadgeCheck, text: "Testing and documentation from the mine to the port of delivery." },
  { title: "Strategic, long-term trade partnerships", icon: LuHandshake, text: "Supply arrangements built to keep your production running." },
];

export const PILLARS: Point[] = [
  { title: "Quality", icon: LuAward, text: "Every consignment meets the specification we agreed with you." },
  { title: "Compliance", icon: LuFileCheck2, text: "Documents and processes that satisfy international trade requirements." },
  { title: "Sustainability", icon: LuLeaf, text: "Responsible mining, fair trade and environmental stewardship." },
  { title: "Transparency", icon: LuEye, text: "You can see where the material comes from and how it was tested." },
  { title: "Timeliness", icon: LuClock, text: "Shipments planned and tracked so they arrive when expected." },
  { title: "Ethical practice", icon: LuScale, text: "Fair dealing with producers, buyers and communities." },
];

/* ───────────── Quality & compliance ───────────── */
export const QUALITY_STEPS: Point[] = [
  { title: "Agree the specification", icon: LuFileCheck2, text: "Before anything moves we write down the grade, size, moisture limits, packaging and delivery terms you need." },
  { title: "Verify the source", icon: LuPickaxe, text: "We work with verified mines and producers and confirm the material comes from the source it is declared to come from." },
  { title: "Test the material", icon: LuFlaskConical, text: "Samples are tested against the agreed specification, and an independent inspection can be arranged when you want one." },
  { title: "Document everything", icon: LuBadgeCheck, text: "A certificate of analysis and clear shipping documents travel with every consignment, so each lot can be traced back." },
  { title: "Inspect at loading", icon: LuShieldCheck, text: "Quantity and condition are checked at loading, and any difference from the agreement is flagged before the vessel sails." },
];

/* ───────────── Sustainability ───────────── */
export const SUSTAINABILITY_PRACTICES: Point[] = [
  { title: "Responsible mining", icon: LuMountain, text: "We favour producers who operate safely, respect their permits and manage the land they work on." },
  { title: "Fair trade", icon: LuScale, text: "Honest pricing and prompt, documented dealings with the producers and buyers we connect." },
  { title: "Environmental stewardship", icon: LuLeaf, text: "We encourage lower-impact handling, efficient logistics and the responsible use of resources." },
  { title: "Traceability", icon: LuCircleCheck, text: "Knowing where material comes from is the first step to improving how it is produced." },
];

/* ───────────── Navigation ───────────── */
export interface NavChild { label: string; href: string; description?: string; icon?: IconType }
export interface NavItem { label: string; href?: string; children?: NavChild[]; wide?: boolean }

export const NAV: NavItem[] = [
  {
    label: "About Us",
    href: "/about",
    children: [
      { label: "Who we are", href: "/about", description: "Our company and what we do" },
      { label: "Our mission & vision", href: "/about#vision", description: "Where we are headed" },
      { label: "Why choose us", href: "/about#why", description: "What sets us apart" },
      { label: "Quality & compliance", href: "/quality-compliance", description: "How we test and document" },
      { label: "Sustainability", href: "/sustainability", description: "Responsible sourcing" },
      { label: "Global operations", href: "/global-operations", description: "Where we work" },
      { label: "Careers", href: "/careers", description: "Join the team" },
    ],
  },
  {
    label: "Minerals",
    href: "/minerals",
    wide: true,
    children: [
      ...MINERALS.filter((m) => m.slug !== "granite-dimension-stones").map((m) => ({ label: m.name, href: `/minerals/${m.slug}`, description: m.short, icon: m.icon })),
      { label: "Product catalogue", href: "/products", description: "Browse everything we supply", icon: LuLayers },
    ],
  },
  { label: "Granite", href: "/minerals/granite-dimension-stones" },
  { label: "Industries", href: "/industries" },
  {
    label: "Insights",
    href: "/insights",
    children: [
      { label: "Market insights", href: "/insights", description: "News, reports and analysis" },
      { label: "Projects & trade stories", href: "/projects", description: "Work we have delivered" },
      { label: "Live commodity desk", href: "/commodity-desk", description: "Prices and trade opportunities" },
    ],
  },
];

export const FOOTER_COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "About Us",
    links: [
      { label: "Who we are", href: "/about" },
      { label: "Mission & vision", href: "/about#vision" },
      { label: "Why choose us", href: "/about#why" },
      { label: "Global operations", href: "/global-operations" },
      { label: "Careers", href: "/careers" },
    ],
  },
  { title: "Minerals", links: MINERALS.map((m) => ({ label: m.name, href: `/minerals/${m.slug}` })) },
  { title: "Industries", links: INDUSTRIES.map((i) => ({ label: i.name, href: `/industries#${i.slug}` })) },
  {
    title: "Insights & Trade",
    links: [
      { label: "Market insights", href: "/insights" },
      { label: "Projects & trade stories", href: "/projects" },
      { label: "Live commodity desk", href: "/commodity-desk" },
      { label: "Product catalogue", href: "/products" },
      { label: "Request a quote", href: "/request-a-quote" },
    ],
  },
  {
    title: "Responsibility",
    links: [
      { label: "Quality & compliance", href: "/quality-compliance" },
      { label: "Sustainability", href: "/sustainability" },
      { label: "Privacy policy", href: "/privacy-policy" },
      { label: "Terms of use", href: "/terms" },
    ],
  },
];

/** Every public path, used by the sitemap and the link checks. Dynamic pages (products, posts, projects, careers) are added from the database. */
export const STATIC_PATHS = [
  "/", "/about", "/minerals", "/industries", "/products", "/insights", "/projects", "/commodity-desk", "/global-operations", "/careers",
  "/contact-us", "/request-a-quote", "/quality-compliance", "/sustainability", "/privacy-policy", "/terms",
  ...MINERALS.map((m) => `/minerals/${m.slug}`),
];
