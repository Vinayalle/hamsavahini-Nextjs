import "server-only";
import { errors } from "../errors";
import { getDb } from "../db";
import { isBannerKey, readBannerFile } from "../banner-files";

/**
 * Read-only data for the PUBLIC website. Nothing here needs a session, so it exposes only what an editor has deliberately
 * published: banners that are `published` AND inside their schedule window. Drafts, archived or expired banners never leave the server.
 */
export interface HeroSlide {
  id: string;
  title: string;
  description: string;
  /** Same-origin, cache-friendly URL of the banner picture, or null when the banner has none (or storage is not configured). */
  imageUrl: string | null;
  linkUrl: string;
  linkLabel: string;
}

const MAX_SLIDES = 8;

/** Banners an editor published whose "show from / show until" window includes today (the end date is inclusive). */
function liveHeroWhere(now: Date) {
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return {
    section: "hero" as const,
    status: "published" as const,
    AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: startOfToday } }] }],
  };
}

export async function getHeroSlides(now = new Date()): Promise<HeroSlide[]> {
  const rows = await getDb().banner.findMany({
    where: liveHeroWhere(now),
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    take: MAX_SLIDES,
    include: { imageFile: { select: { kind: true, scanStatus: true } } },
  });
  return rows.map((b) => ({
    id: b.id,
    title: b.title,
    description: b.subtitle,
    imageUrl: b.imageFile && b.imageFile.kind === "image" && b.imageFile.scanStatus !== "quarantined" ? `/api/public/banner-image/${b.id}?v=${b.updatedAt.getTime()}` : null,
    linkUrl: b.ctaUrl,
    linkLabel: b.ctaLabel,
  }));
}

/** The picture of one LIVE hero banner. Anything else (draft, expired, no picture, quarantined, not a banner file) is a plain 404. */
export async function openBannerImage(bannerId: string, now = new Date()) {
  const banner = await getDb().banner.findFirst({ where: { id: bannerId, ...liveHeroWhere(now) }, include: { imageFile: true } });
  const file = banner?.imageFile;
  if (!file || file.kind !== "image" || file.scanStatus === "quarantined" || !isBannerKey(file.storageKey)) throw errors.notFound("Image");
  try {
    return { file, bytes: await readBannerFile(file.storageKey) };
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") console.error("[site] banner image read failed", code ?? "unknown");
    throw errors.notFound("Image");
  }
}
