/**
 * Where Hamsavahin Aarth Mines sources its commodities, and the markets it supplies (the company's "Commodity Sourcing Locations" sheet).
 * Shown at region or country level only, never as exact mine coordinates. The latitude and longitude are the middle of the region, just
 * to place its pin on the globe. Edit this list to change what the Global operations page shows.
 */
export interface SourcingPlace {
  name: string;
  country: string;
  /** "sourcing" places supply us with commodities; "market" places are where we supply. */
  kind: "sourcing" | "market";
  lat: number;
  lng: number;
  commodities: string[];
}

export const SOURCING_PLACES: SourcingPlace[] = [
  // India
  { name: "Andhra Pradesh", country: "India", kind: "sourcing", lat: 15.9, lng: 79.7, commodities: ["Quartz", "Mica", "Feldspar", "Granite", "Gravel", "Laterite", "Rice", "Sugar"] },
  { name: "Telangana", country: "India", kind: "sourcing", lat: 17.9, lng: 79.1, commodities: ["Granite", "Rice", "Sugar"] },
  { name: "Gujarat", country: "India", kind: "sourcing", lat: 22.3, lng: 71.7, commodities: ["Bauxite"] },
  { name: "Odisha", country: "India", kind: "sourcing", lat: 20.9, lng: 84.0, commodities: ["Ilmenite Sand"] },
  { name: "Madhya Pradesh", country: "India", kind: "sourcing", lat: 23.5, lng: 78.0, commodities: ["Iron Ore"] },
  { name: "Goa", country: "India", kind: "sourcing", lat: 15.3, lng: 74.0, commodities: ["Iron Ore"] },
  { name: "Maharashtra", country: "India", kind: "sourcing", lat: 19.7, lng: 75.7, commodities: ["Sugar"] },
  { name: "Uttar Pradesh", country: "India", kind: "sourcing", lat: 26.8, lng: 80.9, commodities: ["Sugar"] },
  { name: "Karnataka", country: "India", kind: "sourcing", lat: 14.6, lng: 75.7, commodities: ["Sugar"] },
  { name: "India (coal)", country: "India", kind: "sourcing", lat: 23.7, lng: 83.0, commodities: ["Coal"] },
  // Outside India
  { name: "South Africa", country: "South Africa", kind: "sourcing", lat: -29.0, lng: 24.5, commodities: ["Iron Ore", "Coal", "Ilmenite", "Aluminium"] },
  { name: "Zambia", country: "Zambia", kind: "sourcing", lat: -13.1, lng: 27.8, commodities: ["Copper", "Pellets"] },
  { name: "Tanzania", country: "Tanzania", kind: "sourcing", lat: -6.4, lng: 34.9, commodities: ["Copper"] },
  { name: "Indonesia", country: "Indonesia", kind: "sourcing", lat: -0.8, lng: 113.9, commodities: ["Coal"] },
  { name: "Oman", country: "Oman", kind: "sourcing", lat: 21.5, lng: 55.9, commodities: ["Limestone"] },
  { name: "Nepal", country: "Nepal", kind: "sourcing", lat: 28.4, lng: 84.1, commodities: ["Graphite"] },
  // Markets we supply
  { name: "China", country: "China", kind: "market", lat: 35.9, lng: 104.2, commodities: [] },
  { name: "United States of America", country: "United States of America", kind: "market", lat: 39.8, lng: -98.6, commodities: [] },
  { name: "Australia", country: "Australia", kind: "market", lat: -25.3, lng: 133.8, commodities: [] },
];
