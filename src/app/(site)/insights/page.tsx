import Link from "next/link";
import { LuNewspaper } from "react-icons/lu";
import { Pager, PostGridCard } from "@/components/web/sections";
import { CtaBand, EmptyNote, PageHero, Unavailable, bodyFont, container } from "@/components/web/ui";
import { pageMeta, prefill } from "@/content/seo";
import { POST_CATEGORY_LABEL, listPosts, loadPublic } from "@/server/services/public";

export const metadata = pageMeta("Insights", "Market insights, company news, sustainability updates and industry reports from Hamsavahin Aarth Mines.", "/insights");
const PAGE_SIZE = 9;

export default async function InsightsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const category = prefill(sp.category, 40);
  const page = Math.max(1, Number.parseInt(prefill(sp.page, 6), 10) || 1);
  const { data, failed } = await loadPublic(() => listPosts({ category: category || undefined, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }), { items: [], total: 0 });
  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const href = (p: number) => `/insights?${new URLSearchParams({ ...(category ? { category } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`.replace(/\?$/, "");
  const chip = (active: boolean) => `inline-flex items-center rounded-full border px-5 py-2.5 text-sm font-bold transition ${active ? "border-[var(--brand-red)] bg-[var(--brand-red)] text-white" : "border-neutral-200 bg-white text-neutral-700 hover:border-red-200 hover:text-[var(--brand-red)]"}`;
  return (
    <div className={`${bodyFont} text-neutral-800`}>
      <PageHero eyebrow="Insights" title="Market insights and news" description="Analysis of the markets we trade in, updates from our operations and perspectives on responsible sourcing." crumbs={[{ label: "Insights" }]} />
      <section aria-label="Articles" className="bg-neutral-50">
        <div className={`${container} py-14 md:py-20`}>
          <nav aria-label="Filter by category" className="mb-10 flex flex-wrap gap-2.5">
            <Link href="/insights" aria-current={!category ? "true" : undefined} className={chip(!category)}>All</Link>
            {Object.entries(POST_CATEGORY_LABEL).map(([key, label]) => <Link key={key} href={`/insights?category=${key}`} aria-current={category === key ? "true" : undefined} className={chip(category === key)}>{label}</Link>)}
          </nav>
          {failed ? <Unavailable /> : data.items.length === 0 ? (
            <EmptyNote title="No articles yet" text={category ? "There are no articles in this category yet." : "Articles will appear here once they are published."} />
          ) : (
            <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{data.items.map((p, i) => <PostGridCard key={p.slug} post={p} icon={LuNewspaper} index={i} />)}</ul>
          )}
          <Pager page={page} pages={pages} href={href} />
        </div>
      </section>
      <CtaBand title="Want market updates tailored to your needs?" text="Tell us which minerals and regions you follow and we will share what is relevant." primary={{ label: "Contact us", href: "/contact-us?subject=Market%20updates" }} secondary={{ label: "Request a quote", href: "/request-a-quote" }} />
    </div>
  );
}
