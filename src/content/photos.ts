/**
 * Photographs used on the website. They are free-licence photos from Wikimedia Commons, saved in public/images (so the site loads them
 * from its own address). Each one is credited on /photo-credits, as its licence asks.
 */
export interface Photo { src: string; alt: string; credit: { title: string; author: string; license: string; page: string } }

export const PHOTOS = {
  "iron-ore": { src: "/images/iron-ore.jpg", alt: "An open-pit iron ore mine with red earth terraces", credit: { title: "One of the iron ore mines in Keonjhar district", author: "Bikashkumargiri1997", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:One_of_the_iron_ore_mines_in_Keonjhar_district.jpg" } },
  granite: { src: "/images/granite.jpg", alt: "Cut granite blocks in the terraced benches of a granite quarry", credit: { title: "Granite mines", author: "Wikimedia Commons contributor", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:Granite_mines.jpg" } },
  quartz: { src: "/images/quartz.jpg", alt: "A cluster of clear quartz crystals", credit: { title: "Quartz, Tibet", author: "JJ Harrison", license: "CC BY-SA 2.5", page: "https://commons.wikimedia.org/wiki/File:Quartz,_Tibet.jpg" } },
  quality: { src: "/images/quality.jpg", alt: "Rock core samples laid out in trays for inspection", credit: { title: "U12G core samples, Nevada Test Site", author: "US Department of Energy, Sandia National Laboratories", license: "Public domain", page: "https://commons.wikimedia.org/wiki/Category:Core_samples" } },
  sustainability: { src: "/images/sustainability.jpg", alt: "Two people planting a young tree on reclaimed land", credit: { title: "Land Reclamation activities by communities", author: "Audrey Mulama", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:Land_Reclamation_activities_by_communities.jpg" } },
  global: { src: "/images/global.jpg", alt: "A bulk carrier being loaded at a port", credit: { title: "Port of West Sacramento, loading a bulk carrier", author: "Quintin Soloviev", license: "CC BY 4.0", page: "https://commons.wikimedia.org/wiki/File:Port_of_West_Sacramento,_loading_a_bulk_carrier.jpg" } },
} satisfies Record<string, Photo>;

/** The photograph for a mineral's spotlight on the home page (minerals without one keep the icon panel). */
export const MINERAL_PHOTO: Record<string, Photo> = {
  "iron-ore-fines": PHOTOS["iron-ore"],
  "granite-dimension-stones": PHOTOS.granite,
  "quartz-silica-minerals": PHOTOS.quartz,
};

/** More commodities we trade: pictures supplied by the company (public/images/commodities), shown on the home and Minerals pages. */
export const COMMODITY_PHOTOS: { name: string; src: string; alt: string; wide?: boolean }[] = [
  { name: "Thermal Coal", src: "/images/commodities/thermal-coal.jpg", alt: "Lumps and fine pieces of thermal coal" },
  { name: "Petroleum Coke", src: "/images/commodities/petroleum-coke.jpg", alt: "Petroleum coke lumps and crushed coke" },
  { name: "Bauxite", src: "/images/commodities/bauxite.jpg", alt: "Red bauxite aluminium ore" },
  { name: "Silica Sand", src: "/images/commodities/silica-sand.jpg", alt: "High-purity white silica sand" },
  { name: "Phosphate Rock", src: "/images/commodities/phosphate-rock.jpg", alt: "Phosphate rock and crushed phosphate" },
  { name: "Rutile", src: "/images/commodities/rutile.jpg", alt: "Rutile crystals and rutile sand" },
  { name: "Zircon", src: "/images/commodities/zircon.jpg", alt: "Zircon crystals and zircon sand" },
  { name: "Silicomanganese", src: "/images/commodities/silicomanganese.jpg", alt: "Silicomanganese alloy lumps" },
  { name: "Zinc Metal", src: "/images/commodities/zinc.jpg", alt: "Zinc ingots, coils and sheets" },
  { name: "Rice", src: "/images/commodities/rice.jpg", alt: "A bowl of long-grain rice" },
  { name: "Titanium-Bearing Minerals", src: "/images/commodities/titanium-minerals.jpg", alt: "Ilmenite, rutile, leucoxene, anatase and sphene", wide: true },
];

/** Pictures for each mineral's own page (the first is the large one). Minerals with no entry simply show no picture. */
export const MINERAL_GALLERY: Record<string, { src: string; alt: string }[]> = {
  "iron-ore-fines": [PHOTOS["iron-ore"]],
  "granite-dimension-stones": [PHOTOS.granite],
  "quartz-silica-minerals": [{ src: "/images/commodities/silica-sand.jpg", alt: "High-purity white silica sand" }, PHOTOS.quartz],
  silicomanganese: [{ src: "/images/commodities/silicomanganese.jpg", alt: "Silicomanganese alloy lumps" }, { src: "/images/commodities/ferromanganese.jpg", alt: "Ferromanganese alloy lumps" }],
  copper: [{ src: "/images/commodities/copper-cathode.jpg", alt: "Copper cathode sheets" }, { src: "/images/commodities/copper-concentrate.jpg", alt: "Copper concentrate" }, { src: "/images/commodities/copper-ore.jpg", alt: "Copper ore" }],
  "zinc-metal": [{ src: "/images/commodities/zinc.jpg", alt: "Zinc ingots, coils and sheets" }, { src: "/images/commodities/zinc-ore.jpg", alt: "Zinc ore" }],
  "phosphate-rock": [{ src: "/images/commodities/phosphate-rock.jpg", alt: "Phosphate rock and crushed phosphate" }],
  "mineral-sands": [{ src: "/images/commodities/rutile.jpg", alt: "Rutile crystals and rutile sand" }, { src: "/images/commodities/zircon.jpg", alt: "Zircon crystals and zircon sand" }, { src: "/images/commodities/ilmenite.jpg", alt: "Ilmenite ore and sand" }],
  "feldspar-kaolin": [{ src: "/images/commodities/feldspar.jpg", alt: "Feldspar" }, { src: "/images/commodities/kaolin.jpg", alt: "Kaolin (china clay)" }, { src: "/images/commodities/mica.jpg", alt: "Mica" }],
  "thermal-coal": [{ src: "/images/commodities/thermal-coal.jpg", alt: "Lumps and fine pieces of thermal coal" }, { src: "/images/commodities/coking-coal.jpg", alt: "Coking coal" }],
  "petroleum-coke": [{ src: "/images/commodities/petroleum-coke.jpg", alt: "Petroleum coke lumps and crushed coke" }, { src: "/images/commodities/carbon-materials.jpg", alt: "Carbon materials" }],
  rice: [{ src: "/images/commodities/rice.jpg", alt: "A bowl of long-grain rice" }, { src: "/images/commodities/golden-rice.jpg", alt: "Golden parboiled rice in a bowl and a jute sack" }],
  "bauxite-laterite": [{ src: "/images/commodities/bauxite.jpg", alt: "Red bauxite aluminium ore" }],
  "manganese-ore": [{ src: "/images/commodities/silicomanganese.jpg", alt: "Silicomanganese alloy lumps, a manganese product" }],
  "industrial-specialty-minerals": [
    { src: "/images/commodities/zircon.jpg", alt: "Zircon crystals and zircon sand" },
    { src: "/images/commodities/rutile.jpg", alt: "Rutile crystals and rutile sand" },
    { src: "/images/commodities/phosphate-rock.jpg", alt: "Phosphate rock and crushed phosphate" },
  ],
};

/** Every commodity picture supplied by the company (public/images/commodities), grouped for the full range on the Minerals page. */
export type CommodityCategory = "Metals & alloys" | "Ores & concentrates" | "Industrial minerals" | "Coal & carbon" | "Natural stone" | "Agri commodities";
export interface CommodityPhoto { slug: string; name: string; category: CommodityCategory; wide?: boolean }
export const COMMODITY_CATEGORIES: CommodityCategory[] = ["Metals & alloys", "Ores & concentrates", "Industrial minerals", "Coal & carbon", "Natural stone", "Agri commodities"];
export const COMMODITIES: CommodityPhoto[] = [
  { slug: "aluminium-metal", name: "Aluminium Metal", category: "Metals & alloys" },
  { slug: "copper-cathode", name: "Copper Cathode", category: "Metals & alloys" },
  { slug: "nickel-metal", name: "Nickel Metal", category: "Metals & alloys" },
  { slug: "zinc", name: "Zinc Metal", category: "Metals & alloys" },
  { slug: "lead-metal", name: "Lead Metal", category: "Metals & alloys" },
  { slug: "ferrochrome", name: "Ferrochrome", category: "Metals & alloys" },
  { slug: "ferromanganese", name: "Ferromanganese", category: "Metals & alloys" },
  { slug: "ferronickel", name: "Ferronickel", category: "Metals & alloys" },
  { slug: "silicomanganese", name: "Silicomanganese", category: "Metals & alloys" },
  { slug: "iron-ore", name: "Iron Ore", category: "Ores & concentrates" },
  { slug: "manganese-ore", name: "Manganese Ore", category: "Ores & concentrates" },
  { slug: "chromite-ore", name: "Chromite Ore", category: "Ores & concentrates" },
  { slug: "copper-ore", name: "Copper Ore", category: "Ores & concentrates" },
  { slug: "copper-concentrate", name: "Copper Concentrate", category: "Ores & concentrates" },
  { slug: "nickel-ore", name: "Nickel Ore", category: "Ores & concentrates" },
  { slug: "zinc-ore", name: "Zinc Ore", category: "Ores & concentrates" },
  { slug: "lead-ore", name: "Lead Ore (Galena)", category: "Ores & concentrates" },
  { slug: "tin-ore", name: "Tin Ore (Cassiterite)", category: "Ores & concentrates" },
  { slug: "bauxite", name: "Bauxite", category: "Ores & concentrates" },
  { slug: "ilmenite", name: "Ilmenite", category: "Ores & concentrates" },
  { slug: "rutile", name: "Rutile", category: "Ores & concentrates" },
  { slug: "zircon", name: "Zircon", category: "Ores & concentrates" },
  { slug: "graphite", name: "Graphite", category: "Ores & concentrates" },
  { slug: "beneficiated-ilmenite-sand", name: "Beneficiated Ilmenite Sand", category: "Ores & concentrates", wide: true },
  { slug: "titanium-minerals", name: "Titanium-Bearing Minerals", category: "Ores & concentrates", wide: true },
  { slug: "silica-sand", name: "Silica Sand", category: "Industrial minerals" },
  { slug: "quartz", name: "Quartz", category: "Industrial minerals" },
  { slug: "feldspar", name: "Feldspar", category: "Industrial minerals" },
  { slug: "mica", name: "Mica", category: "Industrial minerals" },
  { slug: "kaolin", name: "Kaolin (China Clay)", category: "Industrial minerals" },
  { slug: "bentonite", name: "Bentonite", category: "Industrial minerals" },
  { slug: "barite", name: "Barite", category: "Industrial minerals" },
  { slug: "fluorspar", name: "Fluorspar", category: "Industrial minerals" },
  { slug: "gypsum", name: "Gypsum", category: "Industrial minerals" },
  { slug: "limestone", name: "Limestone", category: "Industrial minerals" },
  { slug: "dolomite", name: "Dolomite", category: "Industrial minerals" },
  { slug: "magnesite", name: "Magnesite", category: "Industrial minerals" },
  { slug: "phosphate-rock", name: "Phosphate Rock", category: "Industrial minerals" },
  { slug: "thermal-coal", name: "Thermal Coal", category: "Coal & carbon" },
  { slug: "coking-coal", name: "Coking Coal", category: "Coal & carbon" },
  { slug: "metallurgical-coke", name: "Metallurgical Coke", category: "Coal & carbon" },
  { slug: "petroleum-coke", name: "Petroleum Coke", category: "Coal & carbon" },
  { slug: "carbon-materials", name: "Carbon Materials", category: "Coal & carbon" },
  { slug: "granite", name: "Granite", category: "Natural stone" },
  { slug: "marble", name: "Marble", category: "Natural stone" },
  { slug: "granite-slabs", name: "Granite Slabs", category: "Natural stone", wide: true },
  { slug: "natural-stone-blocks", name: "Natural Stone Blocks", category: "Natural stone", wide: true },
  { slug: "rice", name: "Long-Grain Rice", category: "Agri commodities" },
  { slug: "golden-rice", name: "Golden Parboiled Rice", category: "Agri commodities" },
  { slug: "ir64-rice", name: "IR64 Parboiled Rice", category: "Agri commodities", wide: true },
];

/** Pictures that show what each industry buys (public/images/commodities); the slugs are the ones in COMMODITIES. */
export const INDUSTRY_MATERIALS: Record<string, string[]> = {
  "steel-metallurgy": ["iron-ore", "manganese-ore", "silicomanganese", "quartz"],
  cement: ["bauxite", "iron-ore", "thermal-coal", "petroleum-coke"],
  "power-energy": ["thermal-coal", "petroleum-coke"],
  "glass-ceramics": ["quartz", "silica-sand", "feldspar", "kaolin"],
  "electrical-cable": ["copper-cathode", "copper-concentrate"],
  "paints-chemicals-fertilisers": ["rutile", "zircon", "ilmenite", "phosphate-rock"],
  "construction-infrastructure": ["granite", "granite-slabs", "natural-stone-blocks"],
};
export const commodityBySlug = (slug: string) => COMMODITIES.find((c) => c.slug === slug);
