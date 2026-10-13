import { LuShip } from "react-icons/lu";
import { ProjectGridCard } from "@/components/web/sections";
import { CtaBand, EmptyNote, PageHero, Unavailable, bodyFont, container } from "@/components/web/ui";
import { pageMeta } from "@/content/seo";
import { listProjects, loadPublic } from "@/server/services/public";

export const metadata = pageMeta("Projects & trade stories", "Consignments, partnerships and projects delivered by Hamsavahin Aarth Mines.", "/projects");

export default async function ProjectsPage() {
  const { data: projects, failed } = await loadPublic(() => listProjects(), []);
  return (
    <div className={`${bodyFont} text-neutral-800`}>
      <PageHero eyebrow="Our work" title="Projects & trade stories" description="A look at the consignments, partnerships and projects we have delivered for customers around the world." crumbs={[{ label: "Projects & trade stories" }]} />
      <section aria-label="Projects" className="bg-neutral-50">
        <div className={`${container} py-14 md:py-20`}>
          {failed ? <Unavailable /> : projects.length === 0 ? (
            <EmptyNote title="Stories are on their way" text="Projects and trade stories will appear here as they are published." />
          ) : (
            <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{projects.map((p, i) => <ProjectGridCard key={p.slug} project={p} icon={LuShip} index={i} />)}</ul>
          )}
        </div>
      </section>
      <CtaBand title="Have a project in mind?" text="Tell us about your requirement and let us show you how we would supply it." />
    </div>
  );
}
