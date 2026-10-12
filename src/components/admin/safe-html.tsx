"use client";

import { useMemo, useSyncExternalStore } from "react";

const ALLOWED = new Set(["P", "BR", "B", "STRONG", "I", "EM", "U", "H2", "H3", "UL", "OL", "LI", "A", "BLOCKQUOTE", "DIV", "SPAN"]);

/** Whitelist sanitizer for previewing editor HTML in the admin. The backend must sanitize independently. */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const walk = (node: Element) => {
    Array.from(node.children).forEach((child) => {
      if (!ALLOWED.has(child.tagName)) {
        child.replaceWith(...Array.from(child.childNodes));
        return;
      }
      Array.from(child.attributes).forEach((attr) => {
        const keep = child.tagName === "A" && attr.name === "href" && /^https?:\/\//i.test(attr.value);
        if (!keep) child.removeAttribute(attr.name);
      });
      if (child.tagName === "A") {
        child.setAttribute("rel", "noopener noreferrer");
        child.setAttribute("target", "_blank");
      }
      walk(child);
    });
  };
  // Drop script/style entirely (their text must not survive).
  doc.querySelectorAll("script,style,iframe,object,embed").forEach((n) => n.remove());
  walk(doc.body);
  return doc.body.innerHTML;
}

const noop = () => () => {};

export function SafeHtml({ html, className }: { html: string; className?: string }) {
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const clean = useMemo(() => (hydrated ? sanitizeHtml(html) : ""), [hydrated, html]);
  return <div className={`rte-content text-sm leading-relaxed text-ink ${className ?? ""}`} dangerouslySetInnerHTML={{ __html: clean }} />;
}
