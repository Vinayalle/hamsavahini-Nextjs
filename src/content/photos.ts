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
  "bauxite-laterite": [{ src: "/images/commodities/bauxite.jpg", alt: "Red bauxite aluminium ore" }],
  "manganese-ore": [{ src: "/images/commodities/silicomanganese.jpg", alt: "Silicomanganese alloy lumps, a manganese product" }],
  "industrial-specialty-minerals": [
    { src: "/images/commodities/zircon.jpg", alt: "Zircon crystals and zircon sand" },
    { src: "/images/commodities/rutile.jpg", alt: "Rutile crystals and rutile sand" },
    { src: "/images/commodities/phosphate-rock.jpg", alt: "Phosphate rock and crushed phosphate" },
  ],
};
