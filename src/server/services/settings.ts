import "server-only";
import { z } from "zod";
import { getDb } from "../db";
import { recordActivity } from "../audit";
import { errors } from "../errors";
import { authorize } from "../rbac";
import type { AuthSession } from "../auth";

/** Website settings sections. Each is stored as one JSON document (SiteSetting key `site.<section>`) and has its own permission. */
const str = (max: number) => z.string().trim().max(max);
const url = str(500).refine((v) => v === "" || /^(https?:\/\/|\/|mailto:|tel:)/i.test(v), "Enter a full link (https://...) or a site path starting with /");

export const SETTINGS_SCHEMAS = {
  general: z.object({ siteName: str(120).min(1, "Site name is required"), tagline: str(200), defaultLanguage: str(10).min(2), timezone: str(60).min(1), maintenanceMode: z.boolean() }).strict(),
  navigation: z.array(z.object({
    id: str(60).min(1), label: str(80).min(1), href: url, visible: z.boolean(),
    children: z.array(z.object({ id: str(60).min(1), label: str(80).min(1), href: url }).strict()).max(30),
  }).strict()).max(40),
  seo: z.object({ titleTemplate: str(160), defaultDescription: str(400), defaultOgImage: url, robotsIndex: z.boolean(), googleSiteVerification: str(200) }).strict(),
  contact: z.object({
    primaryEmail: str(254), primaryPhone: str(40), address: str(500),
    socials: z.object({ linkedin: url, twitter: url, facebook: url, youtube: url }).strict(),
  }).strict(),
  footer: z.object({
    aboutText: str(1000), copyright: str(200), showNewsletter: z.boolean(),
    columns: z.array(z.object({ id: str(60).min(1), title: str(80), links: z.array(z.object({ label: str(80), href: url }).strict()).max(30) }).strict()).max(10),
  }).strict(),
} as const;

export type SettingsSection = keyof typeof SETTINGS_SCHEMAS;
export const isSection = (s: string): s is SettingsSection => Object.prototype.hasOwnProperty.call(SETTINGS_SCHEMAS, s);
const resourceOf = (s: SettingsSection) => `settings_${s}`;

export async function getSetting(session: AuthSession, section: string) {
  if (!isSection(section)) throw errors.notFound("Settings section");
  authorize(session, resourceOf(section), "view");
  const row = await getDb().siteSetting.findUnique({ where: { key: `site.${section}` } });
  return { section, value: row?.value ?? null, updatedAt: row?.updatedAt.toISOString() ?? null };
}

export async function putSetting(session: AuthSession, section: string, body: unknown) {
  if (!isSection(section)) throw errors.notFound("Settings section");
  authorize(session, resourceOf(section), "manage_settings"); // before the body is validated
  const parsed = SETTINGS_SCHEMAS[section].safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[i.path.join(".") || "_"] ??= i.message;
    throw errors.invalid("Some fields are invalid", fields);
  }
  const db = getDb();
  await db.$transaction(async (tx) => {
    await tx.siteSetting.upsert({
      where: { key: `site.${section}` },
      update: { value: parsed.data as object, updatedById: session.user.id },
      create: { key: `site.${section}`, value: parsed.data as object, updatedById: session.user.id },
    });
    await recordActivity(tx, { session, action: "updated", entityType: "Settings", entityLabel: `${section} settings`, detail: "Website settings updated" });
  });
  return getSetting(session, section);
}
