import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LuArrowLeft, LuPackage } from "react-icons/lu";
import { Reveal } from "@/components/web/motion";
import { CheckList, ProductGridCard } from "@/components/web/sections";
import { ButtonLink, CtaBand, JsonLd, PageHero, SectionHeading, Tag, bodyFont, card, container, headingFont } from "@/components/web/ui";
import { pageMeta } from "@/content/seo";
import { COMPANY } from "@/content/site";
import { getProduct, loadPublic, relatedProducts } from "@/server/services/public";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const slug = (await params).slug;
  const p = (await loadPublic(() => getProduct(slug), null)).data;
  return p ? pageMeta(p.metaTitle || p.name, p.metaDescription || p.shortDescription, `/products/${p.slug}`) : {};
}

export default async function ProductPage({ params }: Params) {
  const slug = (await params).slug;
  const { data: product } = await loadPublic(() => getProduct(slug), null);
  if (!product) notFound();
  const related = (await loadPublic(() => relatedProducts(product.slug, product.categorySlug), [])).data;
  const facts = [
    ["Product code", product.code], ["Category", product.category], ["Grade", product.grade], ["Origin", product.origin], ["Packaging", product.packaging],
    ["Loading port", product.loadingPort], ["Target market", product.targetMarket], ["Available quantity", product.quantity],
  ].filter((f): f is [string, string] => !!f[1]);
  const quote = `/request-a-quote?mineral=${encodeURIComponent(product.name)}`;
  return (
    <div className={`${bodyFont} text-neutral-800`}>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Product", name: product.name, description: product.shortDescription, sku: product.code, category: product.category, brand: { "@type": "Brand", name: COMPANY.name } }} />
      <PageHero eyebrow={product.category} title={product.name} description={product.shortDescription} crumbs={[{ label: "Catalogue", href: "/products" }, { label: product.name }]}>
        <div className="flex flex-wrap items-center gap-4">
          <Tag tone={product.availability === "Available" ? "green" : "amber"}>{product.availability}</Tag>
          <ButtonLink href={quote}>Request a quote</ButtonLink>
        </div>
      </PageHero>

      <section aria-label="Product details" className="bg-white">
        <div className={`${container} grid items-start gap-12 py-9 md:py-12 lg:grid-cols-[1.3fr_0.7fr]`}>
          <Reveal variant="left">
            <h2 className={`${headingFont} mb-4 text-[28px] text-neutral-900 md:text-[36px]`}>Description</h2>
            <p className="whitespace-pre-line text-lg leading-8 text-neutral-600">{product.description}</p>
            {product.applications.length > 0 && (<><h3 className="mb-4 mt-9 text-xl font-bold text-neutral-900">Applications</h3><CheckList items={product.applications} /></>)}
            {product.specifications.length > 0 && (
              <>
                <h3 className="mb-4 mt-9 text-xl font-bold text-neutral-900">Specifications</h3>
                <div className="overflow-hidden rounded-2xl border border-neutral-200">
                  <table className="w-full text-left text-base">
                    <caption className="sr-only">Specifications of {product.name}</caption>
                    <thead className="bg-neutral-50 text-sm uppercase tracking-wider text-neutral-500"><tr><th scope="col" className="px-5 py-3">Property</th><th scope="col" className="px-5 py-3">Value</th></tr></thead>
                    <tbody className="divide-y divide-neutral-200">
                      {product.specifications.map((s) => <tr key={s.label}><th scope="row" className="px-5 py-3.5 font-bold text-neutral-800">{s.label}</th><td className="px-5 py-3.5 text-neutral-700">{s.value}{s.unit ? ` ${s.unit}` : ""}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <Link href="/products" className="mt-10 inline-flex items-center gap-2 text-sm font-bold text-gold-700 hover:underline"><LuArrowLeft className="size-4" aria-hidden />Back to the catalogue</Link>
          </Reveal>
          <Reveal variant="right" delay={120}>
            <aside aria-label="Key facts" className={`${card} bg-neutral-50 p-7 lg:sticky lg:top-[calc(var(--site-header-h)+24px)]`}>
              <h3 className="mb-4 text-lg font-bold text-neutral-900">Key facts</h3>
              <dl className="space-y-4">
                {facts.map(([k, v]) => <div key={k}><dt className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">{k}</dt><dd className="mt-0.5 font-bold text-neutral-900">{v}</dd></div>)}
              </dl>
              <div className="mt-6 grid gap-3"><ButtonLink href={quote}>Request a quote</ButtonLink><ButtonLink href={`/contact-us?subject=${encodeURIComponent(`Question about ${product.name}`)}`} variant="outline" arrow={false}>Ask a question</ButtonLink></div>
            </aside>
          </Reveal>
        </div>
      </section>

      {related.length > 0 && (
        <section aria-labelledby="related" className="bg-neutral-50">
          <div className={`${container} py-9 md:py-12`}>
            <SectionHeading id="related" title={`More in ${product.category}`} />
            <ul className="grid gap-5 md:grid-cols-3">{related.map((p, i) => <ProductGridCard key={p.slug} product={p} icon={LuPackage} index={i} />)}</ul>
          </div>
        </section>
      )}
      <CtaBand />
    </div>
  );
}
