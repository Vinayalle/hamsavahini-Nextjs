import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LuArrowLeft, LuCalendar, LuMapPin, LuPackage, LuTag } from "react-icons/lu";
import { Reveal } from "@/components/web/motion";
import { CtaBand, PageHero, Prose, Tag, bodyFont, card, container, formatDate } from "@/components/web/ui";
import { pageMeta } from "@/content/seo";
import { getProject, loadPublic } from "@/server/services/public";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const slug = (await params).slug;
  const p = (await loadPublic(() => getProject(slug), null)).data;
  return p ? pageMeta(p.title, p.summary, `/projects/${p.slug}`) : {};
}

export default async function ProjectPage({ params }: Params) {
  const slug = (await params).slug;
  const { data: project } = await loadPublic(() => getProject(slug), null);
  if (!project) notFound();
  const facts = [
    { icon: LuPackage, label: "Client", value: project.client },
    { icon: LuTag, label: "Commodity", value: project.commodity },
    { icon: LuMapPin, label: "Region", value: project.region },
    { icon: LuCalendar, label: "Period", value: [formatDate(project.start), project.end ? formatDate(project.end) : "ongoing"].join(" to ") },
  ];
  return (
    <div className={`${bodyFont} text-neutral-800`}>
      <PageHero eyebrow="Projects & trade stories" title={project.title} description={project.summary} crumbs={[{ label: "Projects", href: "/projects" }, { label: project.title }]}>
        <Tag tone="red">{project.stage}</Tag>
      </PageHero>
      <section aria-label="Project" className="bg-white">
        <div className={`${container} grid items-start gap-12 py-9 md:py-12 lg:grid-cols-[1.4fr_0.6fr]`}>
          <Reveal variant="left">
            <Prose html={project.html} />
            <Link href="/projects" className="mt-10 inline-flex items-center gap-2 text-sm font-bold text-gold-700 hover:underline"><LuArrowLeft className="size-4" aria-hidden />All projects</Link>
          </Reveal>
          <Reveal variant="right" delay={120}>
            <aside aria-label="Project facts" className={`${card} bg-neutral-50 p-7`}>
              <ul className="space-y-4">
                {facts.map((f) => (
                  <li key={f.label} className="flex items-start gap-3"><f.icon className="mt-1 size-5 shrink-0 text-gold-700" aria-hidden /><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">{f.label}</p><p className="font-bold text-neutral-900">{f.value}</p></div></li>
                ))}
              </ul>
            </aside>
          </Reveal>
        </div>
      </section>
      <CtaBand />
    </div>
  );
}
