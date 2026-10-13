import Link from "next/link";
import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import { LuArrowRight, LuChevronRight, LuInbox, LuTriangleAlert } from "react-icons/lu";
import { cleanHtml } from "@/server/resources/sanitize";
import { Reveal } from "./motion";

/** Shared building blocks of the public website. Server-safe (no hooks); animation comes from <Reveal> and the CSS in (site)/globals.css. */
export const headingFont = "font-[family-name:var(--font-hero-title)] font-normal";
export const bodyFont = "font-[family-name:var(--font-hero-text)]";
export const container = "mx-auto w-full max-w-[1200px] px-5 sm:px-8 lg:px-10";
/** Red gradient "logo" tile behind icons. */
export const badge = "flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--brand-red)] to-rose-700 text-white shadow-lg shadow-red-500/25";
export const card = "rounded-3xl border border-neutral-200 bg-white transition duration-300";
export const cardHover = "hover:-translate-y-1 hover:border-red-200 hover:shadow-2xl hover:shadow-red-500/10";

export interface Crumb { label: string; href?: string }

/** Dark band at the top of every inner page: breadcrumb, title and a short description. */
export function PageHero({ eyebrow, title, description, crumbs, children }: { eyebrow?: string; title: string; description?: string; crumbs?: Crumb[]; children?: ReactNode }) {
  return (
    <section aria-labelledby="page-title" className="relative isolate overflow-hidden bg-neutral-950 text-white">
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(60%_90%_at_85%_10%,rgba(238,58,66,0.45),transparent_62%),radial-gradient(45%_60%_at_5%_100%,rgba(238,58,66,0.2),transparent_62%)]" />
        <div className="about-grid absolute inset-0 opacity-[0.09]" />
        <div className="about-float absolute -right-20 top-0 size-80 rounded-full bg-[var(--brand-red)]/25 blur-3xl" />
      </div>
      <div className={`${container} py-14 md:py-20`}>
        {crumbs && (
          <nav aria-label="Breadcrumb" className="hero-rise mb-6 flex flex-wrap items-center gap-1.5 text-sm text-white/65">
            <Link href="/" className="hover:text-white">Home</Link>
            {crumbs.map((c) => (
              <span key={c.label} className="flex items-center gap-1.5">
                <LuChevronRight className="size-4" aria-hidden />
                {c.href ? <Link href={c.href} className="hover:text-white">{c.label}</Link> : <span className="text-white" aria-current="page">{c.label}</span>}
              </span>
            ))}
          </nav>
        )}
        {eyebrow && <p className="hero-rise mb-4 text-sm font-bold uppercase tracking-[0.2em] text-rose-300" style={{ animationDelay: "80ms" }}>{eyebrow}</p>}
        <h1 id="page-title" className={`${headingFont} hero-rise max-w-4xl text-[32px] leading-[1.1] sm:text-[40px] md:text-[clamp(2.5rem,4.6vw,4rem)]`} style={{ animationDelay: "160ms" }}>{title}</h1>
        {description && <p className="hero-rise mt-5 max-w-2xl text-base leading-7 text-white/80 md:text-lg md:leading-8" style={{ animationDelay: "280ms" }}>{description}</p>}
        <div aria-hidden className="hero-rise mt-7 h-1 w-20 rounded-full bg-gradient-to-r from-[var(--brand-red)] to-rose-300" style={{ animationDelay: "420ms" }} />
        {children && <div className="hero-rise mt-8" style={{ animationDelay: "520ms" }}>{children}</div>}
      </div>
    </section>
  );
}

export function SectionHeading({ id, eyebrow, title, description, light, center }: { id?: string; eyebrow?: string; title: string; description?: string; light?: boolean; center?: boolean }) {
  return (
    <div className={`mb-10 md:mb-14 ${center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}`}>
      {eyebrow && <Reveal as="p" className={`mb-3 text-sm font-bold uppercase tracking-[0.2em] ${light ? "text-rose-300" : "text-[var(--brand-red)]"}`}>{eyebrow}</Reveal>}
      <Reveal delay={80}><h2 id={id} className={`${headingFont} text-[28px] leading-tight md:text-[42px] ${light ? "text-white" : "text-neutral-900"}`}>{title}</h2></Reveal>
      <Reveal variant="bar" delay={200} className={`mt-5 h-1 w-16 rounded-full bg-gradient-to-r from-[var(--brand-red)] to-rose-300 ${center ? "mx-auto" : ""}`} />
      {description && <Reveal delay={260}><p className={`mt-5 text-base leading-7 md:text-lg md:leading-8 ${light ? "text-white/80" : "text-neutral-600"}`}>{description}</p></Reveal>}
    </div>
  );
}

type ButtonVariant = "primary" | "outline" | "white" | "ghost";
const BUTTON: Record<ButtonVariant, string> = {
  primary: "bg-[var(--brand-red)] text-white shadow-lg shadow-red-500/25 hover:bg-red-700",
  outline: "border border-[var(--brand-red)] text-[var(--brand-red)] hover:bg-[var(--brand-red)] hover:text-white",
  white: "bg-white text-neutral-900 hover:bg-neutral-100",
  ghost: "border border-white/30 text-white hover:bg-white/10",
};
export function ButtonLink({ href, children, variant = "primary", arrow = true, className = "" }: { href: string; children: ReactNode; variant?: ButtonVariant; arrow?: boolean; className?: string }) {
  return (
    <Link href={href} className={`group inline-flex items-center gap-2 rounded-lg px-6 py-3.5 text-[15px] font-medium transition-all duration-300 ${BUTTON[variant]} ${className}`}>
      {children}
      {arrow && <LuArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />}
    </Link>
  );
}

/** Closing call-to-action band that sits above the footer on most pages. */
export function CtaBand({ title = "Looking for a reliable mineral supplier?", text = "Tell us what you need and our team will come back with sourcing options, specifications and delivery terms.", primary = { label: "Request a quote", href: "/request-a-quote" }, secondary = { label: "Contact us", href: "/contact-us" } }: { title?: string; text?: string; primary?: { label: string; href: string }; secondary?: { label: string; href: string } }) {
  return (
    <section aria-label="Get in touch" className="relative isolate overflow-hidden bg-gradient-to-br from-[var(--brand-red)] via-red-600 to-rose-800 text-white">
      <div aria-hidden className="about-float absolute -right-16 -top-16 size-72 rounded-full bg-white/10 blur-3xl" />
      <div className={`${container} grid items-center gap-8 py-14 md:grid-cols-[1fr_auto] md:py-20`}>
        <Reveal><div>
          <h2 className={`${headingFont} text-[28px] leading-tight md:text-[40px]`}>{title}</h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/90 md:text-lg">{text}</p>
        </div></Reveal>
        <Reveal delay={120} className="flex flex-wrap gap-3">
          <ButtonLink href={primary.href} variant="white">{primary.label}</ButtonLink>
          <ButtonLink href={secondary.href} variant="ghost" arrow={false}>{secondary.label}</ButtonLink>
        </Reveal>
      </div>
    </section>
  );
}

/** Icon tile + title + text card used for services, reasons, practices and steps. */
export function PointCard({ icon: Icon, title, text, index }: { icon: IconType; title: string; text: string; index?: number }) {
  return (
    <Reveal as="li" delay={((index ?? 0) % 3) * 90}>
      <div className={`${card} ${cardHover} group h-full p-6 md:p-8`}>
        <div aria-hidden className={`${badge} mb-5 size-14 transition-transform duration-500 group-hover:rotate-6 group-hover:scale-110`}><Icon className="size-7" /></div>
        <h3 className="mb-2 text-xl font-bold text-neutral-900">{title}</h3>
        <p className="text-base leading-7 text-neutral-600">{text}</p>
      </div>
    </Reveal>
  );
}

/** Sanitised editor HTML with readable typography. Sanitised again here even though it was sanitised when saved. */
export function Prose({ html, className = "" }: { html: string; className?: string }) {
  return (
    <div
      className={`prose-site text-base leading-8 text-neutral-700 md:text-lg md:leading-9 [&_a]:text-[var(--brand-red)] [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--brand-red)] [&_blockquote]:pl-5 [&_blockquote]:italic [&_h2]:mb-3 [&_h2]:mt-9 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-neutral-900 [&_h3]:mb-2 [&_h3]:mt-7 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-neutral-900 [&_li]:my-1.5 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 ${className}`}
      dangerouslySetInnerHTML={{ __html: cleanHtml(html) }}
    />
  );
}

/** Shown where the admin has not published anything yet. */
export function EmptyNote({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-14 text-center">
      <div aria-hidden className={`${badge} mx-auto mb-5 size-14`}><LuInbox className="size-7" /></div>
      <h3 className="text-xl font-bold text-neutral-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-neutral-600">{text}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** Shown when the database could not be reached, instead of an error page. */
export function Unavailable() {
  return (
    <div role="status" className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <LuTriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
      <p>This section is temporarily unavailable. Please try again in a moment.</p>
    </div>
  );
}

export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "red" | "green" | "amber" }) {
  const tones = { neutral: "bg-neutral-100 text-neutral-700", red: "bg-red-50 text-red-700", green: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-800" };
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}

export const formatDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");

/** schema.org data for search engines. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
