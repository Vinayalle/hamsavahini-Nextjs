import type { IconType } from "react-icons";
import {
  LuAtom, LuAward, LuBadgeCheck, LuBrickWall, LuBuilding2, LuCircleCheck, LuClock, LuEye, LuFactory, LuFileCheck2, LuFlame, LuFlaskConical,
  LuGem, LuGlassWater, LuGlobe, LuHandshake, LuLayers, LuLeaf, LuMountain, LuPickaxe, LuScale, LuShieldCheck, LuShip, LuZap,
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

/**
 * Contact details shown in the website footer, on the Contact Us page and in the search-engine data. They are fixed here in the code, not
 * edited in the admin. Change them in this one place. A line left empty is simply not shown.
 */
export const CONTACT = {
  email: "info@hamsavahin.in",
  phone: "+91 88976 45588",
  address: "Vaishnavi's Symbol, Block C, 1st Floor, Financial District, Nanakramguda, Hyderabad, Telangana 500032",
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
    handling: handlingDefaults("grade and particle size"),
    buyerNotes: ["The mineral and the grade you are looking for", "Particle size and packaging", "Your end use, so we can match the right source"],
  },
];


/**
 * The other commodities in the Minerals menu. Each has its own page, written in the same plain way as the six above (what it is used for and
 * how we handle it, with no claims about volumes or grades). They are listed apart from MINERALS, which stays the six core minerals used by
 * the home page strip and the Minerals page cards.
 */
export const EXTRA_MINERALS: Mineral[] = [
  {
    slug: "silicomanganese", name: "Silicomanganese", icon: LuAtom,
    short: "A manganese and silicon alloy used to deoxidise and strengthen steel.",
    intro: "Silicomanganese is a ferroalloy made from manganese and silicon. Steelmakers add it to remove oxygen from molten steel and to add strength and toughness, so the grade and size are agreed with the plant that will use it.",
    uses: ["Deoxidiser in steelmaking", "Alloying agent for strength, toughness and wear resistance", "Production of carbon and alloy steels"],
    handling: handlingDefaults("manganese and silicon content"),
    buyerNotes: ["Manganese and silicon content you need", "Lump size range", "Quantity per shipment and loading port"],
  },
  {
    slug: "copper", name: "Copper (Concentrate & Cathode)", icon: LuZap,
    short: "Copper concentrate for smelters and refined copper cathode.",
    intro: "Copper is supplied as concentrate, the product of mining and milling that goes to smelters, and as refined cathode for manufacturers. What you need depends on whether you smelt it yourself or use finished metal.",
    uses: ["Smelting and refining into copper metal (concentrate)", "Wire, cable and electrical equipment (cathode)", "Alloys, plumbing and industrial components"],
    handling: handlingDefaults("copper content"),
    buyerNotes: ["Concentrate or cathode", "Copper content and permitted impurities", "Quantity per shipment and delivery port"],
  },
  {
    slug: "zinc-metal", name: "Zinc Metal", icon: LuShieldCheck,
    short: "Zinc metal, mainly used to protect steel from corrosion.",
    intro: "Zinc metal is bought mostly for galvanizing, the zinc coating that protects steel from rust. It is also used in alloys and die casting. Purity and the form of the metal are agreed before shipment.",
    uses: ["Galvanizing steel against corrosion", "Zinc alloys and die casting", "Construction, automotive and industrial products"],
    handling: handlingDefaults("zinc purity and form"),
    buyerNotes: ["Purity grade you need", "Ingots, slabs or other forms", "Quantity per shipment and delivery port"],
  },
  {
    slug: "laterite", name: "Laterite", icon: LuMountain,
    short: "Laterite for cement, refractories and as a source of iron and aluminium.",
    intro: "Laterite is a weathered, iron and aluminium rich rock. It is bought for cement and refractory use, and where the iron or alumina content makes it a feed material. The chemistry that matters depends on the plant.",
    uses: ["Cement raw material", "Refractories", "Iron and alumina bearing feed material"],
    handling: handlingDefaults("laterite chemistry"),
    buyerNotes: ["Iron, alumina and silica limits", "Size range", "Quantity per shipment and loading port"],
  },
  {
    slug: "phosphate-rock", name: "Phosphate Rock", icon: LuLeaf,
    short: "Phosphate rock, the raw material for phosphate fertilisers.",
    intro: "Phosphate rock is the starting material for phosphate fertilisers and phosphorus chemicals. Plants specify the phosphate content and the impurities they can accept, so the specification is agreed before a consignment is arranged.",
    uses: ["Phosphate fertiliser production", "Phosphoric acid and phosphorus chemicals", "Animal feed phosphates"],
    handling: handlingDefaults("phosphate content"),
    buyerNotes: ["Phosphate (P2O5) content and impurity limits", "Rock or crushed form", "Quantity per shipment and loading port"],
  },
  {
    slug: "mineral-sands", name: "Mineral Sands", icon: LuGem,
    short: "Rutile, zircon, ilmenite and other titanium bearing minerals.",
    intro: "Mineral sands are heavy minerals recovered from sand deposits. They include rutile, zircon, ilmenite and other titanium bearing minerals, each with its own use, from pigments and welding to ceramics and foundries.",
    uses: ["Titanium dioxide pigment and titanium metal (rutile, ilmenite)", "Ceramics, glazes and foundry sand (zircon)", "Welding electrodes and coatings"],
    handling: handlingDefaults("mineral content"),
    buyerNotes: ["Which mineral you need (rutile, zircon, ilmenite or other)", "Titanium dioxide or zirconium content and grain size", "Quantity per shipment and loading port"],
  },
  {
    slug: "feldspar-kaolin", name: "Feldspar, Kaolin & Other Industrial Minerals", icon: LuBrickWall,
    short: "Feldspar, kaolin and other minerals for ceramics, glass, paper and paint.",
    intro: "Feldspar and kaolin are bought for what they do in the product: feldspar as a flux in glass and ceramics, kaolin for whiteness and smoothness in ceramics, paper and paint. Other industrial minerals follow the same approach, with the specification agreed first.",
    uses: ["Ceramic bodies, glazes and tiles", "Glass batch", "Paper, paint, plastics and rubber fillers"],
    handling: handlingDefaults("mineral chemistry and whiteness"),
    buyerNotes: ["Which mineral and the grade you need", "Lump or powder, and the particle size", "Quantity per shipment and loading port"],
  },
  {
    slug: "thermal-coal", name: "Thermal Coal", icon: LuFlame,
    short: "Steam coal for power generation and industrial heat.",
    intro: "Thermal coal is burnt to raise steam in power stations and to provide heat in cement and other industry. Buyers specify the calorific value, ash, moisture and sulphur they can use.",
    uses: ["Power generation", "Cement kilns and industrial boilers", "Process heat in manufacturing"],
    handling: handlingDefaults("calorific value, ash and moisture"),
    buyerNotes: ["Calorific value, ash, moisture and sulphur limits", "Size range", "Quantity per shipment and loading port"],
  },
  {
    slug: "petroleum-coke", name: "Petroleum Coke", icon: LuFactory,
    short: "A carbon fuel and raw material, a by-product of oil refining.",
    intro: "Petroleum coke is a carbon rich solid left from refining oil. It is used as a fuel in cement and power, and as a carbon source in industries such as aluminium and calcining. Sulphur and volatile content decide where it can be used.",
    uses: ["Fuel for cement kilns and power generation", "Carbon source for industrial processes", "Calcining and anode material"],
    handling: handlingDefaults("sulphur and volatile content"),
    buyerNotes: ["Sulphur, volatile matter and ash limits", "Fuel grade or calcining grade", "Quantity per shipment and loading port"],
  },
  {
    slug: "rice", name: "Rice", icon: LuLeaf,
    short: "Long-grain and parboiled rice for export.",
    intro: "Rice is supplied for export in the varieties and packings the buyer asks for, including long-grain and parboiled types. Variety, grain length, broken percentage and packing are agreed before shipment.",
    uses: ["Wholesale and retail food supply", "Food service and processing", "Government and institutional buying"],
    handling: handlingDefaults("variety and quality"),
    buyerNotes: ["Variety, for example long-grain or parboiled", "Broken percentage, moisture and packing", "Quantity per shipment and destination port"],
  },
];
export const ALL_MINERALS: Mineral[] = [...MINERALS, ...EXTRA_MINERALS];
export const mineralBySlug = (slug: string) => ALL_MINERALS.find((m) => m.slug === slug);

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
    slug: "steel-metallurgy", name: "Steel & Metallurgy", icon: LuFactory,
    summary: "Steel plants, foundries and ferroalloy makers depend on a steady, consistent supply of ore and alloying minerals.",
    needs: ["Consistent chemistry from lot to lot", "Reliable shipment schedules", "Full test and shipping documentation"],
    minerals: ["iron-ore-fines", "manganese-ore", "silicomanganese", "quartz-silica-minerals"],
  },
  {
    slug: "cement", name: "Cement", icon: LuBrickWall,
    summary: "Cement plants buy raw materials for the kiln and fuel to fire it, in steady volumes and to a set chemistry.",
    needs: ["Raw material chemistry within the plant limits", "Fuel grades with agreed calorific value and sulphur", "Volume supply on a regular schedule"],
    minerals: ["laterite", "bauxite-laterite", "iron-ore-fines", "thermal-coal", "petroleum-coke"],
  },
  {
    slug: "power-energy", name: "Power & Energy", icon: LuZap,
    summary: "Power stations and energy users need fuels with a stated heat value, ash and moisture, delivered on time.",
    needs: ["Agreed calorific value, ash and moisture", "Dependable long-term supply", "Documented quality"],
    minerals: ["thermal-coal", "petroleum-coke"],
  },
  {
    slug: "glass-ceramics", name: "Glass & Ceramics", icon: LuGlassWater,
    summary: "Glass and ceramic makers need clean, well-graded raw materials where colour and purity matter.",
    needs: ["Controlled impurities and colour", "Defined particle size", "Traceable origin and test results"],
    minerals: ["quartz-silica-minerals", "feldspar-kaolin"],
  },
  {
    slug: "electrical-cable", name: "Electrical & Cable", icon: LuAtom,
    summary: "Cable and electrical makers buy copper as refined cathode, or as concentrate for smelting.",
    needs: ["Copper content and purity as specified", "Consistent form and size", "Full test and shipping documentation"],
    minerals: ["copper"],
  },
  {
    slug: "paints-chemicals-fertilisers", name: "Paints, Chemicals & Fertilisers", icon: LuFlaskConical,
    summary: "Pigment, chemical and fertiliser makers buy titanium and zirconium minerals and phosphate rock as their starting materials.",
    needs: ["Mineral content and impurity limits", "Grain size or rock form as specified", "Test results with every shipment"],
    minerals: ["mineral-sands", "phosphate-rock"],
  },
  {
    slug: "construction-infrastructure", name: "Construction & Infrastructure", icon: LuBuilding2,
    summary: "Building and infrastructure projects use natural stone in blocks, slabs and tiles, in large volumes.",
    needs: ["Material that meets the project specification", "Volume supply on a project timeline", "Consistent finish across batches"],
    minerals: ["granite-dimension-stones"],
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
export interface NavGroup { title: string; links: { label: string; href: string }[] }
/** `groups` (when present) is what the desktop and mobile menus show, with a heading per group; `children` is then the flat list of the same links (used to highlight the active page). */
export interface NavItem { label: string; href?: string; children?: NavChild[]; groups?: NavGroup[]; wide?: boolean }

/** The Minerals menu: the company's categories and what is in each; every item has its own page. */
const MINERAL_MENU: NavGroup[] = [
  { title: "Ferrous & Ferroalloys", links: [{ label: "Iron Ore (fines, lumps, pellets)", href: "/minerals/iron-ore-fines" }, { label: "Manganese Ore", href: "/minerals/manganese-ore" }, { label: "Silicomanganese", href: "/minerals/silicomanganese" }] },
  { title: "Non-Ferrous & Base Metals", links: [{ label: "Copper (concentrate, cathode)", href: "/minerals/copper" }, { label: "Bauxite (aluminium ore)", href: "/minerals/bauxite-laterite" }, { label: "Zinc Metal", href: "/minerals/zinc-metal" }] },
  { title: "Industrial Minerals", links: [{ label: "Quartz & Silica (incl. silica sand)", href: "/minerals/quartz-silica-minerals" }, { label: "Laterite", href: "/minerals/laterite" }, { label: "Phosphate Rock", href: "/minerals/phosphate-rock" }, { label: "Mineral Sands (rutile, zircon, other titanium minerals)", href: "/minerals/mineral-sands" }, { label: "Feldspar, kaolin, etc.", href: "/minerals/feldspar-kaolin" }] },
  { title: "Energy & Fuels", links: [{ label: "Thermal Coal", href: "/minerals/thermal-coal" }, { label: "Petroleum Coke", href: "/minerals/petroleum-coke" }] },
  { title: "Dimension Stones", links: [{ label: "Granite (blocks, slabs, tiles)", href: "/minerals/granite-dimension-stones" }] },
  { title: "Agri Commodities", links: [{ label: "Rice", href: "/minerals/rice" }] },
];

export const NAV: NavItem[] = [
  {
    label: "About Us",
    href: "/about",
    children: [
      { label: "Who we are", href: "/about", description: "Our company and what we do" },
      { label: "Our mission & vision", href: "/about#vision", description: "Where we are headed" },
      { label: "Why choose us", href: "/about#why", description: "What sets us apart" },
      { label: "Partner with us", href: "/partner-with-us", description: "Buy, supply or build a long-term partnership" },
      { label: "Quality & compliance", href: "/quality-compliance", description: "How we test and document" },
      { label: "Sustainability", href: "/sustainability", description: "Responsible sourcing" },
    ],
  },
  {
    label: "Minerals & Commodities",
    href: "/minerals",
    wide: true,
    groups: MINERAL_MENU,
    children: MINERAL_MENU.flatMap((g) => g.links.map((l) => ({ label: l.label, href: l.href }))),
  },
  { label: "Products", href: "/products" },
  { label: "Industries", href: "/industries" },
  { label: "Global Operations", href: "/global-operations" },
  { label: "Insights", href: "/insights" },
  { label: "Careers", href: "/careers" },
];

export const FOOTER_COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Company",
    links: [
      { label: "About us", href: "/about" },
      { label: "Quality & compliance", href: "/quality-compliance" },
      { label: "Sustainability", href: "/sustainability" },
      { label: "Partner with us", href: "/partner-with-us" },
      { label: "Careers", href: "/careers" },
    ],
  },
  {
    title: "Trade",
    links: [
      { label: "Minerals & Commodities", href: "/minerals" },
      { label: "Products", href: "/products" },
      { label: "Industries", href: "/industries" },
      { label: "Global operations", href: "/global-operations" },
      { label: "Market insights", href: "/insights" },
      { label: "Contact us", href: "/contact-us" },
    ],
  },
];

/** Every public path, used by the sitemap and the link checks. Dynamic pages (products, posts, projects, careers) are added from the database. */
export const STATIC_PATHS = [
  "/", "/about", "/minerals", "/industries", "/products", "/insights", "/global-operations", "/careers",
  "/contact-us", "/request-a-quote", "/quality-compliance", "/sustainability", "/privacy-policy", "/terms", "/photo-credits", "/partner-with-us",
  ...ALL_MINERALS.map((m) => `/minerals/${m.slug}`),
];
