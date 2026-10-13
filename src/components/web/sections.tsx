import { FaArrowRight } from "react-icons/fa";
import Link from "next/link";
import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import { LuCalendar, LuCircleCheck, LuClock, LuMapPin, LuPackage, LuTag } from "react-icons/lu";
import type { Industry, Mineral, Point } from "@/content/site";
import type { CareerCard, PostCard, ProductCard, ProjectCard } from "@/server/services/public";
import { Reveal } from "./motion";
import { ButtonLink, Tag, badge, card, cardHover, formatDate, headingFont } from "./ui";

/** Reusable page sections of the public website. */

export function MineralCard({ mineral, index = 0 }: { mineral: Mineral; index?: number }) {
  return (
    <Reveal as="li" delay={(index % 3) * 90} variant="scale">
      <Link href={`/minerals/${mineral.slug}`} className={`${card} ${cardHover} group relative flex h-full flex-col overflow-hidden p-6 md:p-7`}>
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-gold-400 to-gold-300 transition-transform duration-500 group-hover:scale-x-100" />
        <div aria-hidden className={`${badge} mb-5 size-14 transition-transform duration-500 group-hover:rotate-6 group-hover:scale-110`}><mineral.icon className="size-7" /></div>
        <h3 className="mb-2 text-xl font-bold text-neutral-900">{mineral.name}</h3>
        <p className="flex-1 text-base leading-7 text-neutral-600">{mineral.short}</p>
        <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-gold-700">Learn more <FaArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden /></span>
      </Link>
    </Reveal>
  );
}

export function IndustryCard({ industry, index = 0, href }: { industry: Industry; index?: number; href?: string }) {
  const body = (
    <>
      <div className="relative">
        <span aria-hidden className="about-ring absolute inset-0 rounded-2xl bg-gold-500/30" />
        <div aria-hidden className={`${badge} relative size-16 transition-transform duration-500 group-hover:rotate-6 group-hover:scale-110`}><industry.icon className="size-8" /></div>
      </div>
      <span className="text-base font-bold leading-snug text-neutral-900">{industry.name}</span>
    </>
  );
  const cls = `${card} ${cardHover} group flex h-full flex-col items-center gap-4 bg-gradient-to-b from-white to-neutral-50 px-4 py-8 text-center`;
  return (
    <Reveal as="li" delay={index * 90}>
      {href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>}
    </Reveal>
  );
}

/** A picture-less hero for a card: gradient panel with a large icon and a category label. */
function CardArt({ icon: Icon, label }: { icon: IconType; label: string }) {
  return (
    <div aria-hidden className="relative flex aspect-[16/9] items-center justify-center overflow-hidden bg-gradient-to-br from-neutral-900 via-neutral-800 to-gold-500/80">
      <div className="about-grid absolute inset-0 opacity-[0.12]" />
      <Icon className="relative size-14 text-white/90 transition-transform duration-500 group-hover:scale-110" strokeWidth={1.4} />
      <span className="absolute left-4 top-4 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white backdrop-blur">{label}</span>
    </div>
  );
}

export function PostGridCard({ post, icon, index = 0 }: { post: PostCard; icon: IconType; index?: number }) {
  return (
    <Reveal as="li" delay={(index % 3) * 90}>
      <Link href={`/insights/${post.slug}`} className={`${card} ${cardHover} group flex h-full flex-col overflow-hidden`}>
        <CardArt icon={icon} label={post.category} />
        <div className="flex flex-1 flex-col p-6">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold text-neutral-500"><LuCalendar className="size-4" aria-hidden />{formatDate(post.date)}</p>
          <h3 className="mb-2 text-xl font-bold leading-snug text-neutral-900 group-hover:text-gold-700">{post.title}</h3>
          <p className="flex-1 text-base leading-7 text-neutral-600">{post.excerpt}</p>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-gold-700">Read article <FaArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden /></span>
        </div>
      </Link>
    </Reveal>
  );
}

export function ProjectGridCard({ project, icon, index = 0 }: { project: ProjectCard; icon: IconType; index?: number }) {
  return (
    <Reveal as="li" delay={(index % 3) * 90}>
      <Link href={`/projects/${project.slug}`} className={`${card} ${cardHover} group flex h-full flex-col overflow-hidden`}>
        <CardArt icon={icon} label={project.stage} />
        <div className="flex flex-1 flex-col p-6">
          <h3 className="mb-2 text-xl font-bold leading-snug text-neutral-900 group-hover:text-gold-700">{project.title}</h3>
          <p className="flex-1 text-base leading-7 text-neutral-600">{project.summary}</p>
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Project details">
            <li><Tag><LuTag className="mr-1 size-3.5" aria-hidden />{project.commodity}</Tag></li>
            <li><Tag><LuMapPin className="mr-1 size-3.5" aria-hidden />{project.region}</Tag></li>
          </ul>
        </div>
      </Link>
    </Reveal>
  );
}

export function ProductGridCard({ product, icon, index = 0 }: { product: ProductCard; icon: IconType; index?: number }) {
  return (
    <Reveal as="li" delay={(index % 3) * 90}>
      <Link href={`/products/${product.slug}`} className={`${card} ${cardHover} group flex h-full flex-col overflow-hidden`}>
        <CardArt icon={icon} label={product.category} />
        <div className="flex flex-1 flex-col p-6">
          <h3 className="mb-2 text-xl font-bold leading-snug text-neutral-900 group-hover:text-gold-700">{product.name}</h3>
          <p className="flex-1 text-base leading-7 text-neutral-600">{product.shortDescription}</p>
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Product details">
            <li><Tag tone={product.availability === "Available" ? "green" : "amber"}>{product.availability}</Tag></li>
            {product.grade && <li><Tag>Grade {product.grade}</Tag></li>}
            {product.origin && <li><Tag><LuMapPin className="mr-1 size-3.5" aria-hidden />{product.origin}</Tag></li>}
          </ul>
        </div>
      </Link>
    </Reveal>
  );
}

export function CareerRow({ career, index = 0 }: { career: CareerCard; index?: number }) {
  return (
    <Reveal as="li" delay={(index % 4) * 70}>
      <Link href={`/careers/${career.slug}`} className={`${card} ${cardHover} group flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-7`}>
        <div className="min-w-0">
          <h3 className="text-xl font-bold text-neutral-900 group-hover:text-gold-700">{career.title}</h3>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-neutral-600" aria-label="Position details">
            <li className="flex items-center gap-1.5"><LuPackage className="size-4" aria-hidden />{career.department}</li>
            <li className="flex items-center gap-1.5"><LuMapPin className="size-4" aria-hidden />{career.location}</li>
            <li className="flex items-center gap-1.5"><LuClock className="size-4" aria-hidden />{career.type}</li>
            <li className="flex items-center gap-1.5"><LuCalendar className="size-4" aria-hidden />Apply by {formatDate(career.deadline)}</li>
          </ul>
        </div>
        <span className="inline-flex shrink-0 items-center gap-2 text-sm font-bold text-gold-700">View and apply <FaArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden /></span>
      </Link>
    </Reveal>
  );
}

/** Two-column feature: text on one side, a gradient "art" panel with an icon on the other. */
export function SplitFeature({ eyebrow, title, children, icon: Icon, action, flip, dark }: { eyebrow?: string; title: string; children: ReactNode; icon: IconType; action?: ReactNode; flip?: boolean; dark?: boolean }) {
  return (
    <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
      <Reveal variant={flip ? "right" : "left"} className={flip ? "md:order-2" : ""}>
        {eyebrow && <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-gold-700">{eyebrow}</p>}
        <h2 className={`${headingFont} mb-5 text-[28px] leading-tight md:text-[40px] ${dark ? "text-white" : "text-neutral-900"}`}>{title}</h2>
        <div className={`space-y-4 text-base leading-7 md:text-lg md:leading-8 ${dark ? "text-white/80" : "text-neutral-600"}`}>{children}</div>
        {action && <div className="mt-8">{action}</div>}
      </Reveal>
      <Reveal variant={flip ? "left" : "right"} delay={120} className={flip ? "md:order-1" : ""}>
        <div aria-hidden className="relative isolate flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[2rem] bg-gradient-to-br from-neutral-900 via-neutral-800 to-gold-500 shadow-2xl shadow-gold-900/20">
          <div className="about-grid absolute inset-0 opacity-[0.12]" />
          <div className="about-float absolute -right-10 -top-10 size-56 rounded-full bg-gold-500/40 blur-3xl" />
          <div className="about-spin-slow absolute size-[70%] rounded-full border border-dashed border-white/25" />
          <div className="about-spin-slow-reverse absolute size-[48%] rounded-full border border-white/20" />
          <div className={`${badge} about-float size-24 md:size-28`}><Icon className="size-12 md:size-14" strokeWidth={1.4} /></div>
        </div>
      </Reveal>
    </div>
  );
}

/** Numbered steps connected by a line. */
export function Steps({ steps }: { steps: Point[] }) {
  return (
    <ol className="relative space-y-6">
      <div aria-hidden className="absolute bottom-4 left-6 top-4 w-px bg-gradient-to-b from-gold-400 via-gold-300 to-transparent md:left-8" />
      {steps.map((s, i) => (
        <Reveal key={s.title} as="li" className="relative pl-[4.5rem] md:pl-28">
          <div aria-hidden className={`${badge} absolute left-0 top-1 size-12 ring-4 ring-white md:size-16`}><s.icon className="size-6 md:size-7" /></div>
          <div className={`${card} p-6 md:p-7`}>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-gold-700">Step {i + 1}</p>
            <h3 className="mb-1.5 text-xl font-bold text-neutral-900">{s.title}</h3>
            <p className="text-base leading-7 text-neutral-600">{s.text}</p>
          </div>
        </Reveal>
      ))}
    </ol>
  );
}

export function CheckList({ items, light }: { items: string[]; light?: boolean }) {
  return (
    <ul className="space-y-3">
      {items.map((t) => (
        <li key={t} className={`flex gap-3 text-base leading-7 md:text-lg ${light ? "text-white/90" : "text-neutral-700"}`}>
          <LuCircleCheck className="mt-1.5 size-5 shrink-0 text-gold-700" aria-hidden />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export function SeeAll({ href, children }: { href: string; children: ReactNode }) {
  return <div className="mt-10 text-center"><ButtonLink href={href} variant="outline">{children}</ButtonLink></div>;
}

/** Previous / next with page numbers. Plain links, so it works without JavaScript. */
export function Pager({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  const numbers = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1);
  const btn = "inline-flex h-11 min-w-11 items-center justify-center rounded-lg border px-3 text-sm font-bold transition";
  return (
    <nav aria-label="Pagination" className="mt-12 flex flex-wrap items-center justify-center gap-2">
      {page > 1 && <Link href={href(page - 1)} rel="prev" className={`${btn} border-neutral-200 bg-white text-neutral-800 hover:border-gold-200 hover:text-gold-700`}>Previous</Link>}
      {numbers.map((n, i) => (
        <span key={n} className="flex items-center gap-2">
          {i > 0 && n - numbers[i - 1] > 1 && <span aria-hidden className="text-neutral-400">…</span>}
          <Link href={href(n)} aria-current={n === page ? "page" : undefined} className={`${btn} ${n === page ? "border-gold-600 bg-gold-500 text-ink" : "border-neutral-200 bg-white text-neutral-800 hover:border-gold-200 hover:text-gold-700"}`}>{n}</Link>
        </span>
      ))}
      {page < pages && <Link href={href(page + 1)} rel="next" className={`${btn} border-neutral-200 bg-white text-neutral-800 hover:border-gold-200 hover:text-gold-700`}>Next</Link>}
    </nav>
  );
}
