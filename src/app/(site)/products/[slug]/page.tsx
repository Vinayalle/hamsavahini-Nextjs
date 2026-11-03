import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FaArrowLeft } from "react-icons/fa";
import { LuChevronRight, LuCircleCheck, LuMapPin, LuPackage } from "react-icons/lu";
import { Reveal } from "@/components/web/motion";
import ProductGallery from "@/components/web/ProductGallery";
import { ProductGridCard } from "@/components/web/sections";
import { ProductQuoteForm } from "@/components/web/forms";
import { ButtonLink, JsonLd, SectionHeading, bodyFont, container, headingFont } from "@/components/web/ui";
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

  return (
    <div className={`${bodyFont} text-neutral-800`}>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Product", name: product.name, description: product.shortDescription, category: product.category, brand: { "@type": "Brand", name: COMPANY.name }, ...(product.gallery.length ? { image: product.gallery.map((g) => g.url) } : {}) }} />

      {/* Hero: the name and what it is used for, beside the pictures */}
      <section aria-labelledby="page-title" className="relative isolate overflow-hidden bg-neutral-950 text-white">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(60%_90%_at_85%_10%,rgba(176,128,64,0.45),transparent_62%),radial-gradient(45%_60%_at_5%_100%,rgba(176,128,64,0.2),transparent_62%)]" />
          <div className="about-grid absolute inset-0 opacity-[0.09]" />
          <div className="about-float absolute -right-20 top-0 size-80 rounded-full bg-gold-500/25 blur-3xl" />
        </div>
        <div className={`${container} py-10 md:py-14`}>
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
              {product.usedFor.length > 0 && (
                <div className="hero-rise mt-6" style={{ animationDelay: "340ms" }}>
                  <p className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-white/60">Used for</p>
                  <ul className="flex flex-wrap gap-2.5">
                    {product.usedFor.map((u) => <li key={u} className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-bold text-white ring-1 ring-white/20">{u}</li>)}
                  </ul>
                </div>
              )}
              <div className="hero-rise mt-9 flex flex-wrap items-center gap-4" style={{ animationDelay: "460ms" }}>
                <ButtonLink href="#quote">Request quote</ButtonLink>
                <ButtonLink href="/products" variant="ghost" arrow={false}>All products</ButtonLink>
              </div>
            </div>
            <div className="hero-rise" style={{ animationDelay: "240ms" }}>
              <ProductGallery images={product.gallery} name={product.name} />
            </div>
          </div>
        </div>
      </section>

      {/* The details the admin wrote, and the quote form beside them */}
      <section aria-label="Product details" className="bg-white">
        <div className={`${container} grid items-start gap-12 py-12 md:py-16 lg:grid-cols-[1.25fr_0.75fr]`}>
          <Reveal variant="left">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-gold-700">Details</p>
            <h2 className={`${headingFont} mb-5 text-[28px] leading-tight text-neutral-900 md:text-[38px]`}>About {product.name}</h2>
            <p className="whitespace-pre-line text-lg leading-8 text-neutral-600">{product.description}</p>
            {product.origin && <p className="mt-6 flex items-center gap-2.5 text-base font-bold text-neutral-800"><LuMapPin className="size-5 shrink-0 text-gold-600" aria-hidden />{product.origin}</p>}
            {product.specifications.length > 0 && (
              <>
                <h3 className="mb-4 mt-10 text-xl font-bold text-neutral-900">Specifications</h3>
                <div className="overflow-hidden rounded-3xl border border-neutral-200 shadow-sm">
                  <table className="w-full text-left text-base">
                    <caption className="sr-only">Specifications of {product.name}</caption>
                    <tbody>
                      {product.specifications.map((x) => (
                        <tr key={x.label} className="border-t border-neutral-200 first:border-t-0 odd:bg-white even:bg-neutral-50">
                          <th scope="row" className="w-2/5 px-6 py-4 font-bold text-neutral-800">{x.label}</th>
                          <td className="px-6 py-4 font-medium text-neutral-700">{x.value}{x.unit ? ` ${x.unit}` : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {product.usedFor.length > 0 && (
              <>
                <h3 className="mb-4 mt-10 text-xl font-bold text-neutral-900">Used for</h3>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {product.usedFor.map((u) => (
                    <li key={u} className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <LuCircleCheck className="mt-0.5 size-5 shrink-0 text-gold-600" aria-hidden />
                      <span className="text-base font-medium leading-6 text-neutral-800">{u}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <Link href="/products" className="mt-10 inline-flex items-center gap-2 text-sm font-bold text-gold-700 hover:underline"><FaArrowLeft className="size-3.5" aria-hidden />Back to the catalogue</Link>
          </Reveal>

          <Reveal variant="right" delay={120}>
            <aside id="quote" aria-labelledby="quote-title" className="scroll-mt-28 overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-xl shadow-neutral-900/5 lg:sticky lg:top-[calc(var(--site-header-h)+24px)]">
              <div className="h-1.5 bg-gradient-to-r from-gold-400 via-gold-500 to-gold-300" aria-hidden />
              <div className="p-7">
                <h2 id="quote-title" className={`${headingFont} text-[24px] leading-tight text-neutral-900`}>Request a quote</h2>
                <p className="mb-6 mt-3 text-base leading-7 text-neutral-600">Need more details about {product.name}? Tell us what you need and our team will reply by email.</p>
                <ProductQuoteForm productSlug={product.slug} productName={product.name} />
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
    </div>
  );
}
