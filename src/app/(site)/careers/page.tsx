import { LuGlobe, LuHandshake, LuTrendingUp } from "react-icons/lu";
import { CareerRow } from "@/components/web/sections";
import { ButtonLink, CtaBand, EmptyNote, PageHero, PointCard, SectionHeading, Unavailable, bodyFont, container } from "@/components/web/ui";
import { pageMeta } from "@/content/seo";
import { listCareers, loadPublic } from "@/server/services/public";

export const metadata = pageMeta("Careers", "Open positions at Hamsavahin Aarth Mines. Join a team that connects mineral producers with industries around the world.", "/careers");

export default async function CareersPage() {
  const { data: careers, failed } = await loadPublic(() => listCareers(), []);
  return (
    <div className={`${bodyFont} text-neutral-800`}>
      <PageHero eyebrow="Join us" title="Careers" description="Help us connect trusted mineral producers with the industries that depend on them." crumbs={[{ label: "Careers" }]} />

      <section aria-labelledby="open-title" className="bg-neutral-50">
        <div className={`${container} py-10 md:py-14`}>
          <SectionHeading id="open-title" eyebrow="Open positions" title={careers.length ? "Find your role" : "No open positions right now"} />
          {failed ? <Unavailable /> : careers.length === 0 ? (
            <EmptyNote title="We are not hiring at the moment" text="New positions are published here as soon as they open. You are welcome to introduce yourself and we will keep your details in mind." action={<ButtonLink href="/contact-us?subject=Career%20enquiry">Introduce yourself</ButtonLink>} />
          ) : (
            <ul className="space-y-4">{careers.map((c, i) => <CareerRow key={c.slug} career={c} index={i} />)}</ul>
          )}
        </div>
      </section>

      <section aria-labelledby="why-title" className="bg-white">
        <div className={`${container} py-10 md:py-14`}>
          <SectionHeading id="why-title" eyebrow="Working with us" title="What you can expect" center />
          <ul className="grid gap-5 md:grid-cols-3">
            <PointCard icon={LuGlobe} title="Work that crosses borders" text="Every day connects producers, ports and buyers in different parts of the world." index={0} />
            <PointCard icon={LuHandshake} title="Relationships that last" text="We value long-term partnerships with producers, customers and colleagues alike." index={1} />
            <PointCard icon={LuTrendingUp} title="Room to learn" text="Sourcing, quality, logistics and market analysis all sit under one roof." index={2} />
          </ul>
        </div>
      </section>
      <CtaBand title="Do not see your role?" text="Send us a note about what you do best. We read every message." primary={{ label: "Contact us", href: "/contact-us?subject=Career%20enquiry" }} secondary={{ label: "About us", href: "/about" }} />
    </div>
  );
}
