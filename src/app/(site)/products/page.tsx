import Link from "next/link";
import { LuPackage, LuSearch } from "react-icons/lu";
import { Pager, ProductGridCard } from "@/components/web/sections";
import { ButtonLink, CtaBand, EmptyNote, PageHero, Unavailable, bodyFont, container } from "@/components/web/ui";
import { pageMeta, prefill } from "@/content/seo";
import { listCategories, listProducts, loadPublic } from "@/server/services/public";

export const metadata = pageMeta("Product catalogue", "Browse the minerals and materials we supply, with grades, origin, packaging and availability.", "/products");
const PAGE_SIZE = 12;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const category = prefill(sp.category, 80);
  const search = prefill(sp.search, 80);
  const page = Math.max(1, Number.parseInt(prefill(sp.page, 6), 10) || 1);
  const [cats, list] = await Promise.all([
    loadPublic(() => listCategories(), []),
    loadPublic(() => listProducts({ category: category || undefined, search: search || undefined, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }), { items: [], total: 0 }),
  ]);
  const pages = Math.max(1, Math.ceil(list.data.total / PAGE_SIZE));
  const href = (p: number) => `/products?${new URLSearchParams({ ...(category ? { category } : {}), ...(search ? { search } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`.replace(/\?$/, "");
  const chip = (active: boolean) => `inline-flex items-center rounded-full border px-5 py-2.5 text-sm font-bold transition ${active ? "border-[var(--brand-red)] bg-[var(--brand-red)] text-white" : "border-neutral-200 bg-white text-neutral-700 hover:border-red-200 hover:text-[var(--brand-red)]"}`;
  return (
    <div className={`${bodyFont} text-neutral-800`}>
      <PageHero eyebrow="Catalogue" title="Product catalogue" description="The materials we supply, with grade, origin, packaging and current availability." crumbs={[{ label: "Product catalogue" }]} />
      <section aria-label="Products" className="bg-neutral-50">
        <div className={`${container} py-14 md:py-20`}>
          <form action="/products" method="get" role="search" className="mb-8 flex flex-col gap-3 sm:flex-row">
            <label htmlFor="product-search" className="sr-only">Search products</label>
            <div className="relative flex-1">
              <LuSearch className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-neutral-400" aria-hidden />
              <input id="product-search" name="search" defaultValue={search} placeholder="Search by name, code or description" maxLength={80} className="h-12 w-full rounded-xl border border-neutral-300 bg-white pl-12 pr-4 text-base focus:border-[var(--brand-red)] focus:outline-none focus:ring-4 focus:ring-red-500/15" />
            </div>
            {category && <input type="hidden" name="category" value={category} />}
            <button type="submit" className="h-12 cursor-pointer rounded-xl bg-[var(--brand-red)] px-8 font-bold text-white transition hover:bg-red-700">Search</button>
          </form>
          {cats.data.length > 0 && (
            <nav aria-label="Filter by category" className="mb-10 flex flex-wrap gap-2.5">
              <Link href={search ? `/products?search=${encodeURIComponent(search)}` : "/products"} aria-current={!category ? "true" : undefined} className={chip(!category)}>All</Link>
              {cats.data.map((c) => <Link key={c.slug} href={`/products?category=${encodeURIComponent(c.slug)}${search ? `&search=${encodeURIComponent(search)}` : ""}`} aria-current={category === c.slug ? "true" : undefined} className={chip(category === c.slug)}>{c.name} <span className="ml-1.5 opacity-70">{c.count}</span></Link>)}
            </nav>
          )}
          {list.failed ? <Unavailable /> : list.data.items.length === 0 ? (
            <EmptyNote title={search || category ? "No products match your search" : "The catalogue is being prepared"} text={search || category ? "Try a different word or clear the filters." : "Products will appear here once they are published. In the meantime, tell us what you need and we will source it."} action={<ButtonLink href={search || category ? "/products" : "/request-a-quote"}>{search || category ? "Clear filters" : "Request a quote"}</ButtonLink>} />
          ) : (
            <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{list.data.items.map((p, i) => <ProductGridCard key={p.slug} product={p} icon={LuPackage} index={i} />)}</ul>
          )}
          <Pager page={page} pages={pages} href={href} />
        </div>
      </section>
      <CtaBand title="Cannot find the grade you need?" text="We source beyond what is listed. Send us your specification." />
    </div>
  );
}
