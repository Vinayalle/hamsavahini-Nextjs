import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { LuAtom as Atom, LuAward as Award, LuBadgeCheck as BadgeCheck, LuBrickWall as BrickWall, LuBuilding2 as Building2, LuCircleCheck as CheckCircle2, LuChevronDown as ChevronDown, LuChevronRight as ChevronRight, LuClock as Clock, LuEye as Eye, LuFactory as Factory, LuFileCheck2 as FileCheck2, LuFlaskConical as FlaskConical, LuFlame as Flame, LuGlassWater as GlassWater, LuGem as Gem, LuGlobe as Globe, LuHandshake as Handshake, LuLayers as Layers, LuLeaf as Leaf, LuChartLine as LineChart, LuMountain as Mountain, LuPickaxe as Pickaxe, LuScale as Scale, LuShieldCheck as ShieldCheck, LuShip as Ship, LuTarget as Target, LuTelescope as Telescope, LuZap as Zap } from "react-icons/lu";
import type { IconType } from "react-icons";
import { fontVars } from "@/components/web/fonts";
import { Reveal, ScrollProgress, TimelineRail } from "@/components/web/motion";

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
const MINERALS: Item[] = [
  { title: "Iron Ore & Fines", icon: Mountain },
  { title: "Quartz & Silica Minerals", icon: Gem },
  { title: "Bauxite & Laterite", icon: Layers },
  { title: "Manganese Ore", icon: Atom },
  { title: "Granite & Dimension Stones", icon: BrickWall },
  { title: "Industrial & Specialty Minerals", icon: FlaskConical },
];
const INDUSTRIES: Item[] = [
  { title: "Steel & Metallurgy", icon: Flame },
  { title: "Glass & Ceramics", icon: GlassWater },
  { title: "Construction & Infrastructure", icon: Building2 },
  { title: "Power & Energy", icon: Zap },
  { title: "Industrial Manufacturing", icon: Factory },
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
  const heading = ["About", "Hamsavahin", "Aarth", "Mines"];
  return (
    <div className={`${fontVars} ${bodyFont} overflow-x-clip text-neutral-800`}>
      <noscript>
        <style>{"[data-reveal]{opacity:1!important;transform:none!important}"}</style>
      </noscript>
      <ScrollProgress />

      {/* ───────── Hero ───────── */}
      <section
        aria-labelledby="about-title"
        className="relative isolate flex items-center overflow-hidden bg-neutral-950 text-white"
        // Same height rule as the home-page hero: screen height minus the navbar (a 440px floor keeps the text clear on very short screens).
        style={{ height: "calc(100svh - var(--site-header-h))", minHeight: 440 }}
      >
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(60%_90%_at_82%_18%,rgba(185,134,38,0.5),transparent_62%),radial-gradient(45%_60%_at_8%_95%,rgba(185,134,38,0.22),transparent_62%)]" />
          <div className="about-grid absolute inset-0 opacity-[0.1]" />
          <div className="about-float absolute -right-24 top-6 size-[26rem] rounded-full bg-gold-500/30 blur-3xl" />
          <div className="about-float-slow absolute -left-28 bottom-[-6rem] size-[22rem] rounded-full bg-gold-500/20 blur-3xl" />
        </div>

        {/* Two columns from 640px up: text on the left, the emblem (decorative rings around a gem) in its own column on the right, so the two always sit
            together instead of drifting apart. The emblem is drawn once at 19rem and scaled to fit each screen (mini at 640/768px). Below 1024px the text column is only as wide as the text and the emblem fills the rest, close beside it. */}
        <div className={`${container} relative grid items-center gap-8 py-12 sm:grid-cols-[auto_minmax(0,1fr)] md:py-16 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]`}>
          <div>
            <nav aria-label="Breadcrumb" className="hero-rise mb-8 flex items-center gap-1.5 text-sm text-white/65">
              <Link href="/" className="hover:text-white">Home</Link>
              <ChevronRight className="size-4" aria-hidden />
              <span className="text-white">About Us</span>
            </nav>
            <p className="hero-rise mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-bold uppercase tracking-[0.18em] backdrop-blur" style={{ animationDelay: "100ms" }}>
              <Pickaxe className="size-4 text-gold-300" aria-hidden /> About Us
            </p>
            <h1 id="about-title" className={`${headingFont} max-w-[10.5em] text-[32px] leading-[1.1] sm:text-[40px] md:text-[clamp(2.5rem,5.2vw,3.5rem)] xl:text-[clamp(3rem,4.4vw,4.75rem)]`}>
              {heading.map((word, i) => (
                <Fragment key={word}>
                  {i > 0 && " "}
                  <span className="hero-rise inline-block" style={{ animationDelay: `${220 + i * 140}ms` }}>{word}</span>
                </Fragment>
              ))}
            </h1>
            <div className="hero-rise mt-8 h-1 w-24 origin-left rounded-full bg-gradient-to-r from-gold-400 to-gold-300" style={{ animationDelay: "900ms" }} aria-hidden />
          </div>

          <div aria-hidden data-emblem className="pointer-events-none relative hidden size-[9rem] justify-self-center sm:block md:size-[13rem] lg:size-[17rem] xl:size-[19rem]">
            <div className="absolute left-1/2 top-1/2 size-[19rem] -translate-x-1/2 -translate-y-1/2 scale-[0.474] md:scale-[0.684] lg:scale-[0.895] xl:scale-100">
              <div className="relative flex size-full items-center justify-center">
                <div className="about-spin-slow absolute inset-0 rounded-full border border-dashed border-white/20" />
                <div className="about-spin-slow-reverse absolute inset-6 rounded-full border border-white/15" />
                <div className="absolute inset-16 rounded-full border border-gold-500/40" />
                <div className="about-float flex size-28 items-center justify-center rounded-3xl bg-gradient-to-br from-gold-400 to-gold-700 shadow-2xl shadow-gold-600/40">
                  <Gem className="size-14 text-white" strokeWidth={1.5} />
                </div>
                <span className="about-float-slow absolute left-2 top-14 flex size-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 backdrop-blur"><Mountain className="size-5" /></span>
                <span className="about-float absolute bottom-10 right-0 flex size-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 backdrop-blur"><Ship className="size-5" /></span>
                <span className="about-float-slow absolute bottom-2 left-16 flex size-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 backdrop-blur"><Leaf className="size-5" /></span>
              </div>
            </div>
          </div>
        </div>
        <div aria-hidden className="about-bob pointer-events-none absolute inset-x-0 bottom-5 flex justify-center text-white/60"><ChevronDown className="size-6" /></div>
      </section>

      {/* ───────── Introduction ───────── */}
      <section aria-label="Introduction" className="bg-white">
        <div className={`${container} py-9 md:py-14`}>
          <div className="grid gap-8 md:grid-cols-12 md:gap-14">
            <Reveal variant="left" className="md:col-span-7">
              <div className="border-l-4 border-gold-600 pl-6 md:pl-8">
                <p className="text-xl leading-9 text-neutral-900 md:text-[26px] md:leading-[1.55]">
                  Hamsavahin Aarth Mines is a global sourcing and trading company connecting trusted mineral producers with industries that demand excellence and reliability. Based in India, we specialize in high-grade mineral and ore supply, providing seamless trade and logistics solutions to clients worldwide.
                </p>
              </div>
            </Reveal>
            <Reveal variant="right" delay={120} className="md:col-span-5">
              <p className="text-base leading-7 text-neutral-600 md:text-lg md:leading-8">
                With decades of collective expertise in mining partnerships, global trade, and logistics, we deliver minerals that meet international standards of quality, compliance, and sustainability. Our commitment to transparency, timeliness, and ethical business practices sets us apart as a reliable global partner in mineral supply.
              </p>
            </Reveal>
          </div>
          <ul aria-label="What we stand for" className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 md:mt-16 lg:grid-cols-6">
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
          <SectionTitle id="what-title" eyebrow="Our services">What We Do</SectionTitle>
          <TimelineRail>
            <ol className="space-y-6 md:space-y-8">
              {WHAT_WE_DO.map((item, i) => (
                <Reveal key={item.title} as="li" className="relative pl-[4.5rem] md:pl-28">
                  <div aria-hidden className={`${badge} absolute left-0 top-2 size-12 ring-4 ring-white md:size-16`}>
                    <item.icon className="size-6 md:size-7" />
                  </div>
                  <div className="group relative overflow-hidden rounded-3xl border border-neutral-200 bg-white p-6 transition duration-300 hover:-translate-y-1 hover:border-gold-200 hover:shadow-2xl hover:shadow-gold-500/10 md:p-8">
                    <span aria-hidden className={`${headingFont} pointer-events-none absolute right-6 top-3 text-[64px] leading-none text-neutral-100 transition-colors duration-300 group-hover:text-gold-100 md:text-[88px]`}>{String(i + 1).padStart(2, "0")}</span>
                    <h3 className="relative mb-2 text-xl font-bold text-neutral-900 md:text-2xl">{item.title}</h3>
                    <p className="relative max-w-2xl text-base leading-7 text-neutral-600 md:text-lg md:leading-8">{item.text}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </TimelineRail>
        </div>
      </section>

      {/* ───────── Minerals ───────── */}
      <section aria-label="Minerals" className="relative overflow-hidden bg-neutral-50">
        <div aria-hidden className="pointer-events-none absolute -right-20 bottom-0 size-80 rounded-full bg-gold-500/10 blur-3xl" />
        <div className={`${container} relative py-9 md:py-14`}>
          <SectionTitle id="minerals-title" eyebrow="What we supply">Our Minerals</SectionTitle>
          <ul aria-labelledby="minerals-title" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MINERALS.map((m, i) => (
              <Reveal key={m.title} as="li" delay={(i % 3) * 100} variant="scale">
                <div className="group relative flex h-full items-center gap-5 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1.5 hover:border-gold-200 hover:shadow-2xl hover:shadow-gold-500/10 md:p-6">
                  <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-gold-400 to-gold-300 transition-transform duration-500 group-hover:scale-x-100" />
                  <div aria-hidden className={`${badge} size-14 transition-transform duration-500 group-hover:rotate-6 group-hover:scale-110`}><m.icon className="size-7" /></div>
                  <span className="text-lg font-bold leading-snug text-neutral-900">{m.title}</span>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* ───────── Industries ───────── */}
      <section aria-label="Industries" className="bg-white">
        <div className={`${container} py-9 md:py-14`}>
          <SectionTitle id="industries-title" eyebrow="Who we serve">Industries We Serve</SectionTitle>
          <ul aria-labelledby="industries-title" className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {INDUSTRIES.map((m, i) => (
              <Reveal key={m.title} as="li" delay={i * 90} className={i === INDUSTRIES.length - 1 ? "col-span-2 md:col-span-1" : ""}>
                <div className="group flex h-full flex-col items-center gap-4 rounded-3xl border border-neutral-200 bg-gradient-to-b from-white to-neutral-50 px-4 py-8 text-center transition duration-300 hover:-translate-y-1.5 hover:border-gold-200 hover:shadow-2xl hover:shadow-gold-500/10">
                  <div className="relative">
                    <span aria-hidden className="about-ring absolute inset-0 rounded-2xl bg-gold-500/30" />
                    <div aria-hidden className={`${badge} relative size-16 transition-transform duration-500 group-hover:rotate-6 group-hover:scale-110`}><m.icon className="size-8" /></div>
                  </div>
                  <span className="text-base font-bold leading-snug text-neutral-900">{m.title}</span>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* ───────── Why partner with us (dark, glass cards) ───────── */}
      <section id="why" aria-labelledby="why-title" className="relative isolate scroll-mt-[var(--site-header-h)] overflow-hidden bg-neutral-950 text-white">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(55%_80%_at_85%_0%,rgba(185,134,38,0.35),transparent_62%),radial-gradient(40%_60%_at_5%_100%,rgba(185,134,38,0.18),transparent_62%)]" />
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

      {/* ───────── Sustainability ───────── */}
      <section aria-labelledby="sustainability-title" className="relative isolate overflow-hidden bg-gradient-to-br from-emerald-950 via-neutral-900 to-neutral-950 text-white">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="about-float absolute -left-16 top-0 size-80 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="about-float-slow absolute -right-10 bottom-0 size-72 rounded-full bg-emerald-400/10 blur-3xl" />
        </div>
        <div className={`${container} grid items-center gap-10 py-10 md:grid-cols-[auto_1fr] md:gap-16 md:py-16`}>
          <Reveal variant="scale">
            <div aria-hidden className="relative mx-auto flex size-32 items-center justify-center md:size-48">
              <span className="about-ring absolute inset-0 rounded-full bg-emerald-400/30" />
              <span className="about-ring absolute inset-0 rounded-full bg-emerald-400/20" style={{ animationDelay: "1.4s" }} />
              <div className="relative flex size-full items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 shadow-2xl shadow-emerald-500/30">
                <Leaf className="size-14 text-white md:size-20" strokeWidth={1.4} />
              </div>
            </div>
          </Reveal>
          <div>
            <Reveal><h2 id="sustainability-title" className={`${headingFont} mb-5 text-[30px] md:text-[46px]`}>Sustainability Commitment</h2></Reveal>
            <Reveal variant="bar" delay={150} className="mb-6 h-1 w-16 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-200" />
            <Reveal delay={200}>
              <p className="max-w-3xl text-base leading-7 text-white/85 md:text-lg md:leading-8">
                At Hamsavahin Aarth Mines, sustainability is integral to our operations. We promote responsible mining practices, fair trade, and environmental stewardship, ensuring that every partnership contributes to a stronger, more sustainable global supply chain.
              </p>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}
