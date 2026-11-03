/**
 * Puts SAMPLE locations on the Global operations globe so the page can be seen with pins. They are made-up examples (not real facilities).
 *
 *   npm run locations:sample              add the sample locations (running it again changes nothing)
 *   npm run locations:sample -- --remove  delete exactly these sample locations again (your own locations are never touched)
 *
 * Remove them, or edit them in Admin > Global Operations / Locations, before the website goes live.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { pgConnection } from "../src/lib/db-url";

type Type = "headquarters" | "regional_office" | "mine" | "processing_facility" | "port_terminal" | "warehouse" | "sourcing_location";
const SAMPLES: { name: string; type: Type; country: string; city: string; lat: number; lng: number; operations: string; capacity: string }[] = [
  { name: "Head Office", type: "headquarters", country: "India", city: "Mumbai", lat: 19.0689, lng: 72.8685, operations: "Sales, trading and customer service", capacity: "" },
  { name: "Iron Ore Mine", type: "mine", country: "India", city: "Keonjhar", lat: 21.63, lng: 85.58, operations: "Open-pit iron ore", capacity: "2 million tonnes a year" },
  { name: "Iron Ore Mine", type: "mine", country: "India", city: "Ballari", lat: 15.14, lng: 76.92, operations: "Open-pit iron ore and fines", capacity: "1.5 million tonnes a year" },
  { name: "Granite Quarry", type: "mine", country: "India", city: "Bengaluru", lat: 13.0, lng: 77.5, operations: "Dimension granite blocks", capacity: "30,000 cubic metres a year" },
  { name: "Quartz Mine", type: "mine", country: "India", city: "Ajmer", lat: 26.45, lng: 74.64, operations: "Silica and quartz lumps", capacity: "200,000 tonnes a year" },
  { name: "Bauxite Mine", type: "mine", country: "India", city: "Koraput", lat: 18.81, lng: 82.71, operations: "Bauxite and laterite", capacity: "1 million tonnes a year" },
  { name: "Manganese Mine", type: "mine", country: "India", city: "Nagpur", lat: 21.15, lng: 79.09, operations: "Manganese ore", capacity: "400,000 tonnes a year" },
  { name: "Beneficiation Plant", type: "processing_facility", country: "India", city: "Paradip", lat: 20.32, lng: 86.61, operations: "Crushing, screening and washing", capacity: "3 million tonnes a year" },
  { name: "Export Port Terminal", type: "port_terminal", country: "India", city: "Visakhapatnam", lat: 17.69, lng: 83.22, operations: "Bulk loading for shipment", capacity: "" },
  { name: "Warehouse", type: "warehouse", country: "India", city: "Chennai", lat: 13.08, lng: 80.27, operations: "Storage, bagging and dispatch", capacity: "50,000 tonnes" },
  { name: "Manganese Sourcing Office", type: "sourcing_location", country: "South Africa", city: "Johannesburg", lat: -26.2, lng: 28.05, operations: "Sourcing and inspection", capacity: "" },
  { name: "Copper Belt Office", type: "regional_office", country: "Zambia", city: "Lusaka", lat: -15.39, lng: 28.32, operations: "Sourcing and inspection", capacity: "" },
  { name: "Bulk Port Terminal", type: "port_terminal", country: "South Africa", city: "Durban", lat: -29.86, lng: 31.02, operations: "Bulk loading and storage", capacity: "" },
  { name: "Europe Office", type: "regional_office", country: "Netherlands", city: "Rotterdam", lat: 51.92, lng: 4.48, operations: "Sales and logistics for Europe", capacity: "" },
  { name: "Middle East Office", type: "regional_office", country: "United Arab Emirates", city: "Dubai", lat: 25.2, lng: 55.27, operations: "Sales and trading for the Gulf", capacity: "" },
  { name: "Far East Office", type: "regional_office", country: "China", city: "Shanghai", lat: 31.23, lng: 121.47, operations: "Sales and shipping for East Asia", capacity: "" },
];

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const remove = process.argv.includes("--remove");

const db = new PrismaClient({ adapter: new PrismaPg(pgConnection(url)) });

// Wrapped in a function: this project is CommonJS, where a top-level await does not compile.
async function main() {
  let n = 0;
  for (const s of SAMPLES) {
    const key = { name_city: { name: s.name, city: s.city } };
    if (remove) {
      const r = await db.location.deleteMany({ where: { name: s.name, city: s.city } });
      n += r.count;
      continue;
    }
    const data = {
      type: s.type, country: s.country, address: `${s.city}, ${s.country} (sample address)`, description: `Sample entry: ${s.operations}.`,
      operations: s.operations || null, capacity: s.capacity || null, phone: "+00 000 000 0000", email: "info@example.test", latitude: s.lat, longitude: s.lng, active: true,
    };
    await db.location.upsert({ where: key, create: { name: s.name, city: s.city, ...data }, update: {} });
    n++;
  }
  console.log(remove ? `Removed ${n} sample locations.` : `Sample locations ready (${n}). Open /global-operations to see them.`);
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
