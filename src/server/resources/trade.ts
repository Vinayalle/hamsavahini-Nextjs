import "server-only";
import { z } from "zod";
import type { ResourceConfig } from "./framework";
import { dateOnly, fromYmd, iso, num, patchOf, pick, publishStatus, text, ymd } from "./shared";
import { errors } from "../errors";

/* ───────────────────────── Commodities ───────────────────────── */
const GROUPS = ["Energy", "Metals", "Agriculture", "Chemicals", "Minerals"] as const;
const commoditySlug = z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens");
const commodityBase = z.object({
  name: text(2, 120, "Name"), slug: commoditySlug, code: z.string().trim().min(2, "Trading code is required").max(10).regex(/^[A-Za-z0-9]+$/, "Letters and numbers only").transform((v) => v.toUpperCase()),
  group: z.enum(GROUPS), unit: text(1, 20, "Unit"), description: text(10, 1000, "Description"), status: publishStatus.default("draft"),
});

export const commodities: ResourceConfig = {
  key: "commodities", permission: "commodities", entity: "Commodity", model: "commodity",
  toDto: (c) => ({ id: c.id, name: c.name, slug: c.slug, code: c.code, group: c.group, unit: c.unit, description: c.description, status: c.status, createdAt: iso(c.createdAt), updatedAt: iso(c.updatedAt) }),
  label: (c) => c.name,
  search: ["name", "code"], sorts: ["name", "code", "group", "status", "updatedAt"], defaultSort: { by: "name", dir: "asc" },
  filters: { status: (v) => ({ status: v }), group: (v) => ({ group: v }) },
  createSchema: commodityBase, patchSchema: patchOf(commodityBase),
  buildCreate: (i) => ({ name: i.name, slug: i.slug, code: i.code, group: i.group, unit: i.unit, description: i.description, status: i.status }),
  buildUpdate: (p) => pick(p, {
    name: (v: string) => ({ name: v }), slug: (v: string) => ({ slug: v }), code: (v: string) => ({ code: v }), group: (v: string) => ({ group: v }),
    unit: (v: string) => ({ unit: v }), description: (v: string) => ({ description: v }), status: (v: string) => ({ status: v }),
  }),
  status: { field: "status", mode: "publish", values: ["draft", "published", "archived"] },
  unique: [
    { fields: ["code"], message: "Another commodity uses this code", errorField: "code", ignoreCase: true },
    { fields: ["slug"], message: "Another commodity uses this slug", errorField: "slug" },
  ],
  // Mirrors ON DELETE RESTRICT on prices and opportunities.
  guardDelete: async (row, db) => {
    const [p, o] = await Promise.all([db.commodityPrice.count({ where: { commodityId: row.id } }), db.tradeOpportunity.count({ where: { commodityId: row.id } })]);
    if (p || o) throw errors.conflict(`It is still used by ${p} price entr${p === 1 ? "y" : "ies"} and ${o} opportunit${o === 1 ? "y" : "ies"}. Archive it instead.`);
  },
};

/* ───────────────────────── Commodity prices (manual entry only) ───────────────────────── */
const CURRENCIES = ["USD", "EUR", "INR", "AED", "CNY"] as const;
const priceBase = z.object({
  commodityId: z.uuid("Choose a commodity"), price: z.number("Enter a price").positive("Price must be greater than zero").max(1e12),
  currency: z.enum(CURRENCIES), unit: text(1, 20, "Unit"), market: text(2, 120, "Market / benchmark"), effectiveDate: dateOnly, status: z.enum(["draft", "published"]).default("draft"),
});

export const commodityPrices: ResourceConfig = {
  key: "commodity-prices", permission: "commodity_prices", entity: "Commodity price", model: "commodityPrice",
  toDto: (p) => ({ id: p.id, commodityId: p.commodityId, price: num(p.price), currency: p.currency, unit: p.unit, market: p.market, effectiveDate: ymd(p.effectiveDate), status: p.status, createdAt: iso(p.createdAt), updatedAt: iso(p.updatedAt) }),
  label: (p) => `${p.market} ${ymd(p.effectiveDate)}`,
  search: ["market"], sorts: ["effectiveDate", "price", "status", "updatedAt"], defaultSort: { by: "effectiveDate", dir: "desc" },
  filters: { commodityId: (v) => ({ commodityId: v }), status: (v) => ({ status: v }) },
  createSchema: priceBase, patchSchema: patchOf(priceBase),
  buildCreate: async (i) => ({ commodityId: i.commodityId, price: i.price, currency: i.currency, unit: i.unit, market: i.market, effectiveDate: fromYmd(i.effectiveDate), status: i.status }),
  buildUpdate: (p) => pick(p, {
    commodityId: (v: string) => ({ commodityId: v }), price: (v: number) => ({ price: v }), currency: (v: string) => ({ currency: v }), unit: (v: string) => ({ unit: v }),
    market: (v: string) => ({ market: v }), effectiveDate: (v: string) => ({ effectiveDate: fromYmd(v) }), status: (v: string) => ({ status: v }),
  }),
  // Prices go live with `publish`; there is no `archive`, so un-publishing returns them to draft.
  status: { field: "status", mode: "publish", values: ["draft", "published"] },
  unique: [{ fields: ["commodityId", "market", "effectiveDate"], message: "A price for this commodity, market and date already exists", errorField: "market" }],
  // The API carries the date as "YYYY-MM-DD"; the column is a DATE.
  uniqueValues: (v) => ({ ...v, effectiveDate: typeof v.effectiveDate === "string" ? fromYmd(v.effectiveDate) : v.effectiveDate }),
};

/* ───────────────────────── Trade opportunities (live commodity desk) ───────────────────────── */
const OPP_STATUS = ["draft", "available", "limited_availability", "under_negotiation", "sold", "requirement_open", "closed"] as const;
const OPP_CATEGORY = ["available_for_sale", "buying_requirement", "active_enquiry", "spot", "long_term", "upcoming_shipment"] as const;

/** "5,000 MT" -> { value: 5000, unit: "MT" }. */
function parseQuantity(input: string): { value: number; unit: string } {
  const m = /^\s*([\d,]+(?:\.\d+)?)\s*(.*)$/.exec(input);
  const value = m ? Number(m[1].replace(/,/g, "")) : NaN;
  if (!m || !Number.isFinite(value) || value <= 0) throw errors.invalid("Enter a quantity such as “5,000 MT”", { quantity: "Enter a quantity such as “5,000 MT”" });
  return { value, unit: (m[2] || "MT").trim().slice(0, 20) };
}
const formatQuantity = (value: unknown, unit: string) => `${Number(String(value)).toLocaleString("en-US", { maximumFractionDigits: 3 })} ${unit}`;

const oppBase = z.object({
  title: text(2, 200, "Title"), commodityId: z.uuid("Choose a commodity"), type: z.enum(["buy", "sell"]), category: z.enum(OPP_CATEGORY).default("available_for_sale"),
  quantity: text(1, 60, "Quantity"), originRegion: text(2, 120, "Origin"), destinationRegion: text(2, 120, "Destination"), incoterm: text(2, 10, "Incoterm"),
  validUntil: dateOnly, description: text(10, 2000, "Details"), status: z.enum(OPP_STATUS).default("draft"),
});

export const tradeOpportunities: ResourceConfig = {
  key: "trade-opportunities", permission: "trade_opportunities", entity: "Trade opportunity", model: "tradeOpportunity",
  toDto: (o) => ({
    id: o.id, title: o.title, commodityId: o.commodityId, type: o.type, category: o.category, quantity: formatQuantity(o.quantityValue, o.quantityUnit),
    originRegion: o.originRegion, destinationRegion: o.destinationRegion, incoterm: o.incoterm, validUntil: ymd(o.validUntil), description: o.description, status: o.status,
    createdAt: iso(o.createdAt), updatedAt: iso(o.updatedAt),
  }),
  label: (o) => o.title,
  search: ["title", "originRegion", "destinationRegion"], sorts: ["validUntil", "title", "status", "updatedAt"], defaultSort: { by: "validUntil", dir: "asc" },
  filters: { status: (v) => ({ status: v }), type: (v) => ({ type: v }), commodityId: (v) => ({ commodityId: v }), category: (v) => ({ category: v }) },
  createSchema: oppBase, patchSchema: patchOf(oppBase),
  buildCreate: (i) => {
    const q = parseQuantity(i.quantity);
    return { title: i.title, commodityId: i.commodityId, type: i.type, category: i.category, quantityValue: q.value, quantityUnit: q.unit, originRegion: i.originRegion, destinationRegion: i.destinationRegion, incoterm: i.incoterm, validUntil: fromYmd(i.validUntil), description: i.description, status: i.status };
  },
  buildUpdate: (p) => ({
    ...pick(p, {
      title: (v: string) => ({ title: v }), commodityId: (v: string) => ({ commodityId: v }), type: (v: string) => ({ type: v }), category: (v: string) => ({ category: v }),
      originRegion: (v: string) => ({ originRegion: v }), destinationRegion: (v: string) => ({ destinationRegion: v }), incoterm: (v: string) => ({ incoterm: v }),
      validUntil: (v: string) => ({ validUntil: fromYmd(v) }), description: (v: string) => ({ description: v }), status: (v: string) => ({ status: v }),
    }),
    ...(p.quantity !== undefined ? (() => { const q = parseQuantity(p.quantity); return { quantityValue: q.value, quantityUnit: q.unit }; })() : {}),
  }),
  // Opportunity states are a workflow (Available -> Under negotiation -> Sold ...), not publish/archive.
  status: { field: "status", mode: "workflow", values: OPP_STATUS },
};
