import type { ReactNode } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { LuAward as Award, LuBadgeCheck as BadgeCheck, LuCircleCheck as CheckCircle2, LuChevronRight as ChevronRight, LuClock as Clock, LuEye as Eye, LuFileCheck2 as FileCheck2, LuGlobe as Globe, LuHandshake as Handshake, LuLeaf as Leaf, LuChartLine as LineChart, LuMountain as Mountain, LuPickaxe as Pickaxe, LuScale as Scale, LuShieldCheck as ShieldCheck, LuShip as Ship, LuTarget as Target, LuTelescope as Telescope } from "react-icons/lu";
import type { IconType } from "react-icons";
import { fontVars } from "@/components/web/fonts";
import { CountUp, Reveal, ScrollProgress, TimelineRail } from "@/components/web/motion";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Hamsavahin Aarth Mines is a global sourcing and trading company connecting trusted mineral producers with industries that demand excellence and reliability.",
};

/* ───────────── Page content (plain data, so wording changes never touch the layout below) ───────────── */
interface Item { title: string; text?: string; icon: IconType }

const PILLARS: Item[] = [
  { title: "Quality", icon: Award },
  { title: "Compliance", icon: FileCheck2 },
  { title: "Sustainability", icon: Leaf },
  { title: "Transparency", icon: Eye },
  { title: "Timeliness", icon: Clock },
  { title: "Ethical practices", icon: Scale },
];
const MISSION = [
  "Deliver consistent quality and on-time supply across markets.",
  "Build long-term partnerships with producers and buyers.",
  "Uphold sustainability, traceability, and ethical sourcing in all operations.",
  "Empower industries through reliable access to premium minerals.",
];
const WHAT_WE_DO: Item[] = [
  { title: "Global Mineral Sourcing", icon: Pickaxe, text: "We source high-grade minerals directly from verified mines and producers, ensuring purity, consistency, and commercial value for every consignment." },
  { title: "Quality & Certification", icon: BadgeCheck, text: "Each shipment is tested and certified to international standards, with full traceability and transparent documentation." },
  { title: "End-to-End Logistics", icon: Ship, text: "From mine to port, we manage the entire supply chain — including warehousing, shipping, and customs — ensuring smooth and timely delivery." },
  { title: "Long-Term Supply Partnerships", icon: Handshake, text: "We work closely with industrial clients to establish dependable sourcing strategies and long-term contracts that ensure production continuity." },
  { title: "Market Intelligence", icon: LineChart, text: "Our team provides actionable insights into market trends, price movements, and demand forecasts to support informed procurement decisions." },
];
const WHY_PARTNER: Item[] = [
  { title: "Global reach with local expertise", icon: Globe },
  { title: "Proven track record of reliability", icon: ShieldCheck },
  { title: "Ethical and transparent operations", icon: Scale },
  { title: "Quality assurance at every stage", icon: BadgeCheck },
  { title: "Strategic, long-term trade partnerships", icon: Handshake },
];

/* ───────────── Shared pieces ───────────── */
const headingFont = "font-[family-name:var(--font-hero-title)] font-normal";
const bodyFont = "font-[family-name:var(--font-hero-text)]";
const container = "mx-auto w-full max-w-[1200px] px-5 sm:px-8 lg:px-10";
/** Red gradient "logo" tile behind every topic icon. */
const badge = "flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400 to-gold-700 text-white shadow-lg shadow-gold-500/25";

function SectionTitle({ id, eyebrow, light, children }: { id: string; eyebrow?: string; light?: boolean; children: ReactNode }) {
  return (
    <div className="mb-10 md:mb-14">
      {eyebrow && (
        <Reveal as="p" className={`${bodyFont} mb-3 text-sm font-bold uppercase tracking-[0.2em] ${light ? "text-gold-300" : "text-gold-700"}`}>{eyebrow}</Reveal>
      )}
      <Reveal delay={80}>
        <h2 id={id} className={`${headingFont} text-[30px] leading-tight md:text-[46px] ${light ? "text-white" : "text-neutral-900"}`}>{children}</h2>
      </Reveal>
      <Reveal variant="bar" delay={220} className="mt-5 h-1 w-16 rounded-full bg-gradient-to-r from-gold-400 to-gold-300" />
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className={`${fontVars} ${bodyFont} overflow-x-clip text-neutral-800`}>
      <noscript>
        <style>{"[data-reveal]{opacity:1!important;transform:none!important}"}</style>
      </noscript>
      <ScrollProgress />

      {/* ───────── Hero ───────── */}
      <section
        aria-labelledby="who-title"
        className="relative isolate overflow-hidden bg-neutral-950 text-white"
      >
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(60%_90%_at_82%_18%,rgba(176,128,64,0.5),transparent_62%),radial-gradient(45%_60%_at_8%_95%,rgba(176,128,64,0.22),transparent_62%)]" />
          <div className="about-grid absolute inset-0 opacity-[0.1]" />
          <div className="about-float absolute -right-24 top-6 size-[26rem] rounded-full bg-gold-500/30 blur-3xl" />
          <div className="about-float-slow absolute -left-28 bottom-[-6rem] size-[22rem] rounded-full bg-gold-500/20 blur-3xl" />
        </div>

        <div className={`${container} relative grid items-center gap-8 pb-10 pt-8 md:grid-cols-[1.1fr_0.9fr] md:gap-12 md:pb-12 md:pt-12`}>
          <div>
            <nav aria-label="Breadcrumb" className="hero-rise mb-6 flex items-center gap-1.5 text-sm text-white/65">
              <Link href="/" className="hover:text-white">Home</Link>
              <ChevronRight className="size-4" aria-hidden />
              <span className="text-white">About Us</span>
            </nav>
            <p className="hero-rise mb-5 inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-gold-500/15 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-gold-200 backdrop-blur" style={{ animationDelay: "80ms" }}>
              <Pickaxe className="size-4 text-gold-300" aria-hidden /> About Us
            </p>
            <h1 id="who-title" className={`${headingFont} hero-rise text-[38px] leading-[1.08] text-white sm:text-[48px] md:text-[clamp(3rem,5.4vw,4.75rem)]`} style={{ animationDelay: "160ms" }}>
              Who we <span className="shimmer-text">are</span>
            </h1>
            <div aria-hidden className="hero-rise mt-6 h-1 w-24 rounded-full bg-gradient-to-r from-gold-400 to-gold-200" style={{ animationDelay: "320ms" }} />
          </div>

          <div aria-hidden className="relative mx-auto hidden h-[300px] w-full max-w-[460px] sm:block md:h-[330px]">
            <div className="about-float absolute left-1/2 top-1/2 size-60 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-500/35 blur-3xl" />
            <figure className="about-bob absolute right-0 top-0 h-[78%] w-[66%] overflow-hidden rounded-3xl shadow-2xl shadow-black/50 ring-1 ring-white/25">
              <img src="/images/about-mine.jpg" alt="" width={1100} height={620} decoding="async" className="size-full object-cover" />
            </figure>
            <figure className="about-bob absolute bottom-0 left-0 h-[56%] w-[52%] overflow-hidden rounded-3xl shadow-2xl shadow-black/60 ring-4 ring-neutral-950" style={{ animationDelay: "-1.1s" }}>
              <img src="/images/about-port.jpg" alt="" width={900} height={506} decoding="async" className="size-full object-cover" />
            </figure>
            <span className="about-float absolute left-[8%] top-[10%] flex size-12 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-gold-200 backdrop-blur"><Mountain className="size-6" /></span>
            <span className="about-float-slow absolute bottom-[22%] right-[2%] flex size-12 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-gold-200 backdrop-blur"><Ship className="size-6" /></span>
          </div>
        </div>
        <div className={`${container} relative pb-12 md:pb-16`}>
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-gold-600/20 bg-[#fbf5ea] shadow-2xl shadow-black/40">
              <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-gold-300 via-gold-500 to-gold-700" />
              <span aria-hidden className={`${headingFont} pointer-events-none absolute left-6 top-1 select-none text-[96px] leading-none text-gold-500/25 md:left-12 md:text-[110px]`}>&ldquo;</span>
              <div className="grid gap-8 p-7 pl-9 pt-14 md:p-12 md:pl-14 md:pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:gap-0">
                <p className="relative text-lg leading-8 text-neutral-900 md:text-[21px] md:leading-[1.75] lg:pr-12">
                  Hamsavahin Aarth Mines is an India-based mineral sourcing and trading company serving industrial clients both domestically and internationally. We act as a reliable link between verified mines and producers and the industries that depend on them, including steel and metallurgy, cement, glass and ceramics, power and energy, and infrastructure.
                </p>
                <p className="relative border-t border-gold-600/20 pt-8 text-base leading-8 text-neutral-600 md:text-[17px] lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
                  Our portfolio includes iron ore and fines, manganese ore, quartz and silica, bauxite and laterite, granite and dimension stones, and a range of industrial and specialty minerals. We source from established mining regions across India and from select international origins. We supply on both spot and long-term contract basis, to buyers within India and in overseas markets.
                </p>
              </div>
              <div className="grid gap-5 border-t border-gold-600/20 bg-gold-50/70 px-7 py-6 pl-9 md:grid-cols-2 md:px-12 md:pl-14">
                <ul aria-label="Industries we serve" className="flex flex-wrap gap-2">
                  {["Steel & Metallurgy", "Cement", "Glass & Ceramics", "Power & Energy", "Infrastructure"].map((t, i) => (
                    <Reveal key={t} as="li" variant="scale" delay={200 + i * 70} className="rounded-full border border-gold-600/30 bg-white px-3.5 py-1 text-sm font-bold text-gold-800">{t}</Reveal>
                  ))}
                </ul>
                <ul aria-label="Supply terms" className="grid grid-cols-2 gap-x-4 gap-y-2 md:justify-self-end">
                  {["Spot supply", "Long-term contracts", "Within India", "Overseas markets"].map((t) => (
                    <li key={t} className="flex items-center gap-2 text-sm font-bold text-gold-800"><CheckCircle2 className="size-4 shrink-0 text-gold-600" aria-hidden />{t}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────── Our story ───────── */}
      <section aria-labelledby="story-title" className="bg-neutral-50">
        <div className={`${container} grid items-center gap-12 py-14 md:grid-cols-[0.85fr_1.15fr] md:gap-16 md:py-20`}>
          <Reveal variant="left" className="relative mx-auto w-full max-w-[460px] pb-8 md:mx-0">
            <div aria-hidden className="absolute -inset-3 -z-10 -rotate-3 rounded-[2.25rem] bg-gradient-to-br from-gold-400/60 via-gold-300/30 to-transparent" />
            <figure className="group overflow-hidden rounded-[2rem] shadow-2xl shadow-neutral-900/25 ring-1 ring-black/10">
              <img src="/images/global.jpg" alt="A bulk carrier being loaded at a port" width={1400} height={1000} loading="lazy" decoding="async" className="aspect-[4/5] w-full object-cover transition-transform duration-1000 group-hover:scale-105" />
            </figure>
            <div className="about-bob absolute -bottom-0 right-4 rounded-2xl border border-gold-600/30 bg-gradient-to-br from-neutral-950 to-ink px-6 py-4 text-white shadow-2xl shadow-black/40 md:-right-6">
              <span className="sr-only">30+ years of combined experience</span>
              <p aria-hidden className={`${headingFont} text-[40px] leading-none text-gold-300`}><CountUp to={30} suffix="+" /></p>
              <p aria-hidden className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/80">Years of combined<br />experience</p>
            </div>
          </Reveal>

          <Reveal variant="right" delay={120}>
            <h2 id="story-title" className={`${headingFont} text-[32px] leading-tight text-neutral-900 md:text-[50px]`}>Our story</h2>
            <div aria-hidden className="mb-7 mt-5 h-1 w-20 rounded-full bg-gradient-to-r from-gold-500 to-gold-300" />
            <p className="text-base leading-8 text-neutral-700 md:text-lg md:leading-9">
              Hamsavahin Aarth Mines was established in 2025 by a board of industry professionals with over 30 years of combined experience in mining, mineral trading, export operations and logistics. Over three decades, our leadership has built strong working relationships with mine owners, industrial buyers, port authorities, shipping lines and inspection agencies, both in India and internationally.
            </p>
            <blockquote className="relative mt-8 overflow-hidden rounded-3xl bg-gradient-to-br from-neutral-950 to-ink p-7 text-white shadow-2xl shadow-neutral-900/25 ring-1 ring-white/10 md:p-9">
              <div aria-hidden className="about-float absolute -right-8 -top-8 size-36 rounded-full bg-gold-500/35 blur-3xl" />
              <span aria-hidden className={`${headingFont} pointer-events-none absolute left-4 top-0 select-none text-[80px] leading-none text-gold-400/40`}>&ldquo;</span>
              <p className="relative pt-5 text-lg font-semibold leading-8 text-gold-100 md:text-[21px] md:leading-9">The company was founded to bring this experience into a single, focused organisation: one that understands the mine, understands the buyer, and manages everything in between.</p>
            </blockquote>
          </Reveal>
        </div>
      </section>

      {/* ───────── Introduction ───────── */}
      <section aria-label="What we stand for" className="bg-white">
        <div className={`${container} py-9 md:py-14`}>
          <ul aria-label="What we stand for" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {PILLARS.map((p, i) => (
              <Reveal key={p.title} as="li" delay={i * 70} variant="scale">
                <div className="group flex h-full flex-col items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-5 text-center transition duration-300 hover:-translate-y-1 hover:border-gold-200 hover:bg-white hover:shadow-xl hover:shadow-gold-500/10">
                  <div aria-hidden className={`${badge} size-11 transition-transform duration-500 group-hover:rotate-6 group-hover:scale-110`}><p.icon className="size-5" /></div>
                  <span className="text-sm font-bold text-neutral-900">{p.title}</span>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* ───────── Vision and mission ───────── */}
      <section id="vision" aria-label="Vision and mission" className="relative scroll-mt-[var(--site-header-h)] overflow-hidden bg-neutral-100">
        <div aria-hidden className="pointer-events-none absolute -left-24 top-10 size-72 rounded-full bg-gold-500/10 blur-3xl" />
        <div className={`${container} relative grid gap-6 py-9 md:grid-cols-2 md:gap-8 md:py-14`}>
          <Reveal variant="left">
            <article aria-labelledby="vision-title" className="about-sheen group relative h-full overflow-hidden rounded-3xl bg-gradient-to-br from-gold-400 via-gold-600 to-gold-800 p-8 text-white shadow-2xl shadow-gold-600/25 md:p-12">
              <Telescope aria-hidden className="absolute -bottom-6 -right-6 size-48 text-white/10 transition-transform duration-700 group-hover:rotate-6 group-hover:scale-110" strokeWidth={1.2} />
              <div aria-hidden className="mb-6 flex size-14 items-center justify-center rounded-2xl border border-white/30 bg-white/15 backdrop-blur"><Telescope className="size-7" /></div>
              <h2 id="vision-title" className={`${headingFont} mb-4 text-[28px] md:text-[38px]`}>Our Vision</h2>
              <p className="relative text-base leading-7 text-white/95 md:text-lg md:leading-8">
                To become a globally trusted and sustainable leader in mineral sourcing and trading, building bridges between resource-rich regions and industries shaping the world’s future.
              </p>
            </article>
          </Reveal>
          <Reveal variant="right" delay={120}>
            <article aria-labelledby="mission-title" className="relative h-full overflow-hidden rounded-3xl border border-neutral-200 bg-white p-8 shadow-xl shadow-neutral-900/5 md:p-12">
              <div aria-hidden className={`${badge} mb-6 size-14`}><Target className="size-7" /></div>
              <h2 id="mission-title" className={`${headingFont} mb-5 text-[28px] text-neutral-900 md:text-[38px]`}>Our Mission</h2>
              <ul className="space-y-4">
                {MISSION.map((m, i) => (
                  <Reveal key={m} as="li" delay={200 + i * 110} className="flex gap-3 text-base leading-7 md:text-lg md:leading-8">
                    <CheckCircle2 className="mt-1.5 size-5 shrink-0 text-gold-700" aria-hidden />
                    <span>{m}</span>
                  </Reveal>
                ))}
              </ul>
            </article>
          </Reveal>
        </div>
      </section>

      {/* ───────── What we do: a timeline that fills as you scroll ───────── */}
      <section aria-labelledby="what-title" className="bg-white">
        <div className={`${container} py-9 md:py-14`}>
          <SectionTitle id="what-title">How we work</SectionTitle>
          <TimelineRail>
            <ol className="space-y-6 md:space-y-8">
              {WHAT_WE_DO.map((item) => (
                <Reveal key={item.title} as="li" className="relative pl-[4.5rem] md:pl-28">
                  <div aria-hidden className={`${badge} absolute left-0 top-2 size-12 ring-4 ring-white md:size-16`}>
                    <item.icon className="size-6 md:size-7" />
                  </div>
                  <div className="group relative overflow-hidden rounded-3xl border border-neutral-200 bg-white p-6 transition duration-300 hover:-translate-y-1 hover:border-gold-200 hover:shadow-2xl hover:shadow-gold-500/10 md:p-8">
                    <h3 className="relative mb-2 text-xl font-bold text-neutral-900 md:text-2xl">{item.title}</h3>
                    <p className="relative max-w-2xl text-base leading-7 text-neutral-600 md:text-lg md:leading-8">{item.text}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </TimelineRail>
        </div>
      </section>

      {/* ───────── Why partner with us (dark, glass cards) ───────── */}
      <section id="why" aria-labelledby="why-title" className="relative isolate scroll-mt-[var(--site-header-h)] overflow-hidden bg-neutral-950 text-white">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(55%_80%_at_85%_0%,rgba(176,128,64,0.35),transparent_62%),radial-gradient(40%_60%_at_5%_100%,rgba(176,128,64,0.18),transparent_62%)]" />
          <div className="about-grid absolute inset-0 opacity-[0.07]" />
        </div>
        <div className={`${container} py-9 md:py-14`}>
          <SectionTitle id="why-title" light eyebrow="Our promise">Why Partner With Us</SectionTitle>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WHY_PARTNER.map((w, i) => (
              <Reveal key={w.title} as="li" delay={(i % 3) * 100} className={i === WHY_PARTNER.length - 1 ? "sm:col-span-2 lg:col-span-1" : ""}>
                <div className="group flex h-full items-start gap-5 rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-gold-400/50 hover:bg-white/[0.1] md:p-7">
                  <div aria-hidden className={`${badge} size-14 transition-transform duration-500 group-hover:rotate-6 group-hover:scale-110`}><w.icon className="size-7" /></div>
                  <span className="pt-1 text-lg font-bold leading-snug text-white">{w.title}</span>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
