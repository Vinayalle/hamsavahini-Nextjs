import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LuArrowLeft, LuCalendar, LuNewspaper, LuUser } from "react-icons/lu";
import { PostGridCard } from "@/components/web/sections";
import { CtaBand, JsonLd, PageHero, Prose, SectionHeading, Tag, bodyFont, container, formatDate } from "@/components/web/ui";
import { pageMeta } from "@/content/seo";
import { COMPANY } from "@/content/site";
import { getPost, loadPublic, relatedPosts } from "@/server/services/public";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const slug = (await params).slug;
  const p = (await loadPublic(() => getPost(slug), null)).data;
  return p ? pageMeta(p.metaTitle || p.title, p.metaDescription || p.excerpt, `/insights/${p.slug}`) : {};
}

export default async function PostPage({ params }: Params) {
  const slug = (await params).slug;
  const { data: post } = await loadPublic(() => getPost(slug), null);
  if (!post) notFound();
  const related = (await loadPublic(() => relatedPosts(post.slug, post.categoryKey), [])).data;
  return (
    <div className={`${bodyFont} text-neutral-800`}>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Article", headline: post.title, description: post.excerpt, datePublished: post.date, author: { "@type": "Person", name: post.author }, publisher: { "@type": "Organization", name: COMPANY.name } }} />
      <PageHero eyebrow={post.category} title={post.title} crumbs={[{ label: "Insights", href: "/insights" }, { label: post.title }]}>
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/75" aria-label="Article details">
          <li className="flex items-center gap-2"><LuCalendar className="size-4" aria-hidden />{formatDate(post.date)}</li>
          <li className="flex items-center gap-2"><LuUser className="size-4" aria-hidden />{post.author}</li>
        </ul>
      </PageHero>

      <article className="bg-white">
        <div className={`${container} py-14 md:py-20`}>
          <div className="mx-auto max-w-3xl">
            <p className="mb-8 border-l-4 border-[var(--brand-red)] pl-5 text-xl leading-9 text-neutral-800 md:text-2xl md:leading-10">{post.excerpt}</p>
            <Prose html={post.html} />
            {post.tags.length > 0 && <ul className="mt-10 flex flex-wrap gap-2" aria-label="Tags">{post.tags.map((t) => <li key={t}><Tag>#{t}</Tag></li>)}</ul>}
            <Link href="/insights" className="mt-10 inline-flex items-center gap-2 text-sm font-bold text-[var(--brand-red)] hover:underline"><LuArrowLeft className="size-4" aria-hidden />Back to all insights</Link>
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section aria-labelledby="more" className="bg-neutral-50">
          <div className={`${container} py-14 md:py-20`}>
            <SectionHeading id="more" title="Keep reading" />
            <ul className="grid gap-5 md:grid-cols-3">{related.map((p, i) => <PostGridCard key={p.slug} post={p} icon={LuNewspaper} index={i} />)}</ul>
          </div>
        </section>
      )}
      <CtaBand />
    </div>
  );
}
