import "server-only";
import { errors } from "../errors";
import type { ResourceConfig } from "./framework";
import { banners, careers, locations, posts, projects } from "./content";
import { commodities, commodityPrices, tradeOpportunities } from "./trade";
import { applications, enquiries, rfqs } from "./inbox";
import { activityLogs, notifications } from "./system";
import { documents, media } from "./library";

/**
 * Registry of generic CMS modules served by /api/[resource]. Products, categories, users and roles have their own
 * dedicated services. Media and documents are listed/edited here; their files are created by the upload routes (object storage).
 */
export const RESOURCES: Record<string, ResourceConfig> = Object.fromEntries(
  [posts, projects, careers, locations, banners, commodities, commodityPrices, tradeOpportunities, rfqs, enquiries, applications, notifications, activityLogs, media, documents].map((r) => [r.key, r]),
);

export function resourceFor(key: string): ResourceConfig {
  const cfg = Object.prototype.hasOwnProperty.call(RESOURCES, key) ? RESOURCES[key] : undefined;
  if (!cfg) throw errors.notFound("Resource");
  return cfg;
}
