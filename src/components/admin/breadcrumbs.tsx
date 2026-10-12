"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { SEGMENT_LABELS, findNavLabel } from "@/config/navigation";
import { useShell } from "./shell";

export interface Crumb {
  label: string;
  href?: string;
}

/** Modules that have a `/admin/<module>/<id>` detail page. Others only have list + edit, so the record crumb must not link. */
const HAS_DETAIL_PAGE = new Set(["products", "posts", "projects", "careers"]);

function build(pathname: string, lastLabel: string | null): Crumb[] {
  const parts = pathname.split("/").filter(Boolean); // ["admin","products","prd_001","edit"]
  const crumbs: Crumb[] = [];
  let acc = "";
  parts.forEach((seg, i) => {
    acc += `/${seg}`;
    if (i === 0) return; // "admin" is represented by the home icon
    const known = findNavLabel(acc) ?? SEGMENT_LABELS[seg];
    // Dynamic record segment: use the label provided by the page, if any.
    const label = known ?? lastLabel ?? seg;
    const isRecordSegment = !known; // a dynamic id such as prd_001
    const linkable = i !== parts.length - 1 && (!isRecordSegment || HAS_DETAIL_PAGE.has(parts[1]));
    crumbs.push({ label, href: linkable ? acc : undefined });
  });
  return crumbs;
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const { crumb } = useShell();
  const crumbs = build(pathname, crumb?.path === pathname ? crumb.label : null);

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1.5 text-[13px] text-muted">
        <li>
          <Link href="/admin/dashboard" className="flex items-center hover:text-ink" aria-label="Dashboard">
            <Home className="size-3.5" aria-hidden />
          </Link>
        </li>
        {crumbs.map((c, i) => (
          <Fragment key={`${c.label}-${i}`}>
            <ChevronRight className="size-3.5 shrink-0 text-faint" aria-hidden />
            <li className="min-w-0 truncate">
              {c.href ? (
                <Link href={c.href} className="hover:text-ink">{c.label}</Link>
              ) : (
                <span className="font-medium text-ink" aria-current="page">{c.label}</span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}

/** Pages with dynamic segments call this to name the final breadcrumb (e.g. a product name). */
export { useBreadcrumbLabel } from "./use-breadcrumb-label";
