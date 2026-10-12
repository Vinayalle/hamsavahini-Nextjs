import "server-only";
import { z } from "zod";

export const slug = z.string().trim().min(2, "Slug is required").max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens");
export const publishStatus = z.enum(["draft", "published", "archived"]);
export const dateOnly = z.iso.date("Use a valid date (YYYY-MM-DD)");
export const optionalDate = z.union([dateOnly, z.literal(""), z.null()]).optional().transform((v) => (v ? v : null));
export const text = (min: number, max: number, label = "This field") => z.string().trim().min(min, min ? `${label} is required` : undefined).max(max);
export const optionalText = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));
export const richText = (min: number) => z.string().min(1, "Content is required").max(200_000).refine((v) => v.replace(/<[^>]*>/g, "").trim().length >= min, `Add at least ${min} characters`);

export const seoSchema = z.object({
  metaTitle: z.string().trim().max(70, "Max 70 characters").default(""),
  metaDescription: z.string().trim().max(160, "Max 160 characters").default(""),
  keywords: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
}).default({ metaTitle: "", metaDescription: "", keywords: [] });

/** YYYY-MM-DD for @db.Date values (and timestamps treated as dates). */
export const ymd = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null);
/** Midnight UTC for a YYYY-MM-DD string. */
export const fromYmd = (s: string | null | undefined): Date | null => (s ? new Date(`${s}T00:00:00.000Z`) : null);
export const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
export const num = (d: { toString(): string } | null | undefined): number | null => (d == null ? null : Number(d.toString()));

/**
 * PATCH schema: every field optional WITHOUT re-applying defaults. (zod's `.partial()` keeps `.default()` on omitted keys, so
 * a PATCH of just `{ title }` would silently reset `status` to "draft", `featured` to false, `tags` to [] ...)
 */
type Unwrap<S> = S extends z.ZodDefault<infer I> ? I : S;
export function patchOf<T extends z.ZodRawShape>(schema: z.ZodObject<T>): z.ZodObject<{ [K in keyof T]: z.ZodOptional<Unwrap<T[K]> extends z.ZodType ? Unwrap<T[K]> : never> }> {
  const shape: Record<string, z.ZodType> = {};
  for (const [key, value] of Object.entries(schema.shape)) {
    const field = value as z.ZodType;
    shape[key] = (field instanceof z.ZodDefault ? (field.unwrap() as z.ZodType) : field).optional();
  }
  return z.object(shape) as never;
}

/** Applies a rule for every key actually present in `patch`. Keeps PATCH semantics (omitted = unchanged). */
export function pick(patch: Record<string, unknown>, rules: Record<string, (value: never) => Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, rule] of Object.entries(rules)) if (patch[key] !== undefined) Object.assign(out, rule(patch[key] as never));
  return out;
}
