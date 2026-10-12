import "server-only";
import sanitizeHtml from "sanitize-html";

/**
 * Editor content is stored as HTML, so it is sanitised on the SERVER before it is saved (the browser's
 * contentEditable output is untrusted input). Only a small formatting whitelist survives; scripts, styles,
 * event handlers, iframes and non-http(s) links are removed.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "b", "strong", "i", "em", "u", "h2", "h3", "ul", "ol", "li", "a", "blockquote", "div", "span"],
  allowedAttributes: { a: ["href", "rel", "target"] },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => ({ tagName, attribs: { href: attribs.href ?? "", rel: "noopener noreferrer", target: "_blank" } }),
  },
};

export function cleanHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS).trim();
}

/** Plain-text length of HTML (used to reject "empty" rich-text bodies). */
export function textLength(html: string): number {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/&nbsp;/g, " ").trim().length;
}
