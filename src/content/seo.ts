import type { Metadata } from "next";

/** Page metadata with a canonical URL and matching Open Graph tags (the layout supplies the site name and base URL). */
export function pageMeta(title: string, description: string, path: string): Metadata {
  return { title, description, alternates: { canonical: path }, openGraph: { title, description, url: path, type: "website" } };
}

/** Keeps a query-string value short and printable before it is used to pre-fill a form. */
export function prefill(value: string | string[] | undefined, max = 150): string {
  const v = Array.isArray(value) ? value[0] : value;
  return (v ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}
