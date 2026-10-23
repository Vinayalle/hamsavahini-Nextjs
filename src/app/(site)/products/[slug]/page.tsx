import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FaArrowLeft } from "react-icons/fa";
import { LuAward, LuChevronRight, LuCircleCheck, LuGlobe, LuHash, LuMapPin, LuPackage, LuScale, LuShip } from "react-icons/lu";
import { Reveal } from "@/components/web/motion";
import ProductGallery from "@/components/web/ProductGallery";
import { ProductGridCard } from "@/components/web/sections";
import { ButtonLink, CtaBand, JsonLd, SectionHeading, Tag, bodyFont, container, headingFont } from "@/components/web/ui";
import { pageMeta } from "@/content/seo";
import { COMPANY } from "@/content/site";
import { getProduct, loadPublic, relatedProducts } from "@/server/services/public";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const slug = (await params).slug;
  const p = (await loadPublic(() => getProduct(slug), null)).data;
  return p ? pageMeta(p.name, p.shortDescription, `/products/${p.slug}`) : {};
}

export default async function ProductPage({ params }: Params) {
  const slug = (await params).slug;
  const { data: product } = await loadPublic(() => getProduct(slug), null);
  if (!product) notFound();
  const related = (await loadPublic(() => relatedProducts(product.slug, product.categorySlug), [])).data;
  const quote = `/request-a-quote?mineral=${encodeURIComponent(product.name)}`;
  const ask = `/contact-us?subject=${encodeURIComponent(`Question about ${product.name}`)}`;
  const available = product.availability === "Available";
  /** The facts that make a buying decision, each with its own icon. Empty ones are left out. */
  const facts = [
    { label: "Grade", value: product.grade, icon: LuAward },
    { label: "Origin", value: product.origin, icon: LuMapPin },
    { label: "Available quantity", value: product.quantity, icon: LuScale },
    { label: "Packaging", value: product.packaging, icon: LuPackage },
    { label: "Loading port", value: product.loadingPort, icon: LuShip },
    { label: "Target market", value: product.targetMarket, icon: LuGlobe },
  ].filter((f): f is { label: string; value: string; icon: typeof LuAward } => !!f.value);

  return (
    <div className={`${bodyFont} text-neutral-800`}>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Product", name: product.name, description: product.shortDescription, sku: product.code, category: product.category, brand: { "@type": "Brand", name: COMPANY.name }, ...(product.gallery.length ? { image: product.gallery.map((g) => g.url) } : {}) }} />

      {/* Hero: the name and the buying actions beside the pictures */}
      <section aria-labelledby="page-title" className="relative isolate overflow-hidden bg-neutral-950 text-white">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(60%_90%_at_85%_10%,rgba(185,134,38,0.45),transparent_62%),radial-gradient(45%_60%_at_5%_100%,rgba(185,134,38,0.2),transparent_62%)]" />
          <div className="about-grid absolute inset-0 opacity-[0.09]" />
          <div className="about-float absolute -right-20 top-0 size-80 rounded-full bg-gold-500/25 blur-3xl" />
        </div>
        <div className={`${container} pb-20 pt-8 md:pb-28 md:pt-10`}>
          <nav aria-label="Breadcrumb" className="hero-rise mb-8 flex flex-wrap items-center gap-1.5 text-sm text-white/65">
            <Link href="/" className="hover:text-white">Home</Link>
            <LuChevronRight className="size-4" aria-hidden />
            <Link href="/products" className="hover:text-white">Catalogue</Link>
            <LuChevronRight className="size-4" aria-hidden />
            <span className="text-white" aria-current="page">{product.name}</span>
          </nav>
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
            <div>
              <p className="hero-rise mb-4 inline-flex items-center gap-2 rounded-full border border-gold-300/30 bg-gold-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-gold-300" style={{ animationDelay: "80ms" }}>{product.category}</p>
              <h1 id="page-title" className={`${headingFont} hero-rise text-[34px] leading-[1.08] sm:text-[44px] md:text-[clamp(2.6rem,4.4vw,4rem)]`} style={{ animationDelay: "160ms" }}>{product.name}</h1>
              <div aria-hidden className="hero-rise mt-6 h-1 w-20 rounded-full bg-gradient-to-r from-gold-400 to-gold-300" style={{ animationDelay: "260ms" }} />
              <p className="hero-rise mt-6 max-w-xl text-base leading-7 text-white/80 md:text-lg md:leading-8" style={{ animationDelay: "320ms" }}>{product.shortDescription}</p>
              <ul className="hero-rise mt-6 flex flex-wrap items-center gap-2.5" aria-label="Product summary" style={{ animationDelay: "400ms" }}>
                <li className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold ${available ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-300/30" : "bg-amber-400/15 text-amber-200 ring-1 ring-amber-300/30"}`}>
                  <span aria-hidden className={`size-2 rounded-full ${available ? "bg-emerald-300" : "bg-amber-300"}`} />{product.availability}
                </li>
                <li className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-bold text-white/90 ring-1 ring-white/15"><LuHash className="size-4 text-gold-300" aria-hidden />{product.code}</li>
              </ul>
              <div className="hero-rise mt-9 flex flex-wrap items-center gap-4" style={{ animationDelay: "500ms" }}>
                <ButtonLink href={quote}>Request a quote</ButtonLink>
                <ButtonLink href={ask} variant="ghost" arrow={false}>Ask a question</ButtonLink>
              </div>
            </div>
            <div className="hero-rise" style={{ animationDelay: "240ms" }}>
              <ProductGallery images={product.gallery} name={product.name} />
            </div>
          </div>
        </div>
      </section>

      {/* Key facts, overlapping the hero */}
      {facts.length > 0 && (
        <section aria-label="Key facts" className="relative z-10 -mt-12 md:-mt-16">
          <div className={container}>
            <Reveal>
              <dl className="grid gap-px overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-200 shadow-2xl shadow-neutral-900/10 sm:grid-cols-2 lg:grid-cols-3">
                {facts.map((f) => (
                  <div key={f.label} className="flex items-center gap-4 bg-white p-5 md:p-6">
                    <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400 to-gold-700 text-white shadow-md shadow-gold-500/25"><f.icon className="size-6" /></span>
                    <div className="min-w-0">
                      <dt className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-500">{f.label}</dt>
                      <dd className="mt-0.5 break-words text-lg font-bold leading-snug text-neutral-900">{f.value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </section>
      )}

      {/* Overview, uses and specifications, with the request card beside them */}
      <section aria-label="Product details" className="bg-white">
        <div className={`${container} grid items-start gap-12 py-12 md:py-16 lg:grid-cols-[1.45fr_0.55fr]`}>
          <div className="space-y-14">
            <Reveal variant="left">
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-gold-700">Overview</p>
              <h2 className={`${headingFont} mb-5 text-[28px] leading-tight text-neutral-900 md:text-[38px]`}>About {product.name}</h2>
              <p className="whitespace-pre-line text-lg leading-8 text-neutral-600">{product.description}</p>
            </Reveal>

            {product.applications.length > 0 && (
              <Reveal variant="left">
                <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-gold-700">Where it is used</p>
                <h2 className={`${headingFont} mb-6 text-[26px] leading-tight text-neutral-900 md:text-[32px]`}>Applications</h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {product.applications.map((a) => (
                    <li key={a} className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 transition hover:border-gold-300 hover:bg-gold-50/60">
                      <LuCircleCheck className="mt-0.5 size-5 shrink-0 text-gold-600" aria-hidden />
                      <span className="text-base font-medium leading-6 text-neutral-800">{a}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            )}

            {product.specifications.length > 0 && (
              <Reveal variant="left">
                <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-gold-700">Technical data</p>
                <h2 className={`${headingFont} mb-6 text-[26px] leading-tight text-neutral-900 md:text-[32px]`}>Specifications</h2>
                <div className="overflow-hidden rounded-3xl border border-neutral-200 shadow-sm">
                  <table className="w-full text-left text-base">
                    <caption className="sr-only">Specifications of {product.name}</caption>
                    <thead className="bg-gradient-to-r from-neutral-950 to-neutral-800 text-sm uppercase tracking-[0.14em] text-gold-300">
                      <tr><th scope="col" className="px-6 py-4 font-bold">Property</th><th scope="col" className="px-6 py-4 font-bold">Value</th></tr>
                    </thead>
                    <tbody>
                      {product.specifications.map((s) => (
                        <tr key={s.label} className="border-t border-neutral-200 transition-colors odd:bg-white even:bg-neutral-50 hover:bg-gold-50/70">
                          <th scope="row" className="px-6 py-4 font-bold text-neutral-800">{s.label}</th>
                          <td className="px-6 py-4 font-medium text-neutral-700">{s.value}{s.unit ? ` ${s.unit}` : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Reveal>
            )}

            <Link href="/products" className="inline-flex items-center gap-2 text-sm font-bold text-gold-700 hover:underline"><FaArrowLeft className="size-3.5" aria-hidden />Back to the catalogue</Link>
          </div>

          <Reveal variant="right" delay={120}>
            <aside aria-label="Request this material" className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-xl shadow-neutral-900/5 lg:sticky lg:top-[calc(var(--site-header-h)+24px)]">
              <div className="h-1.5 bg-gradient-to-r from-gold-400 via-gold-500 to-gold-300" aria-hidden />
              <div className="p-7">
                <Tag tone={available ? "green" : "amber"}>{product.availability}</Tag>
                <h2 className={`${headingFont} mt-4 text-[24px] leading-tight text-neutral-900`}>Interested in {product.name}?</h2>
                <p className="mt-3 text-base leading-7 text-neutral-600">Tell us the quantity, delivery port and timing. Our team replies by email with availability and pricing.</p>
                <div className="mt-6 grid gap-3">
                  <ButtonLink href={quote} className="justify-center">Request a quote</ButtonLink>
                  <ButtonLink href={ask} variant="outline" arrow={false} className="justify-center">Ask a question</ButtonLink>
                </div>
                <p className="mt-5 flex items-center gap-2 border-t border-neutral-200 pt-5 text-sm text-neutral-500"><LuHash className="size-4 text-gold-600" aria-hidden />Product code <strong className="text-neutral-800">{product.code}</strong></p>
              </div>
            </aside>
          </Reveal>
        </div>
      </section>

      {related.length > 0 && (
        <section aria-labelledby="related" className="bg-neutral-50">
          <div className={`${container} py-10 md:py-14`}>
            <SectionHeading id="related" eyebrow="Keep exploring" title={`More in ${product.category}`} />
            <ul className="grid gap-5 md:grid-cols-3">{related.map((p, i) => <ProductGridCard key={p.slug} product={p} icon={LuPackage} index={i} />)}</ul>
          </div>
        </section>
      )}
      <CtaBand />
    </div>
  );
}
