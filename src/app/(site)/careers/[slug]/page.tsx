import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LuCalendar, LuClock, LuMapPin, LuPackage, LuUsers } from "react-icons/lu";
import { ApplyForm } from "@/components/web/forms";
import { Reveal } from "@/components/web/motion";
import { JsonLd, PageHero, Prose, Tag, bodyFont, card, container, formatDate, headingFont } from "@/components/web/ui";
import { pageMeta } from "@/content/seo";
import { COMPANY } from "@/content/site";
import { getCareer, loadPublic } from "@/server/services/public";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const slug = (await params).slug;
  const career = (await loadPublic(() => getCareer(slug), null)).data;
  return career ? pageMeta(`${career.title} (${career.location})`, `Apply for ${career.title} in ${career.department} at ${COMPANY.name}.`, `/careers/${career.slug}`) : {};
}

export default async function CareerPage({ params }: Params) {
  const slug = (await params).slug;
  const { data: career } = await loadPublic(() => getCareer(slug), null);
  if (!career) notFound();
  const facts = [
    { icon: LuPackage, label: "Department", value: career.department },
    { icon: LuMapPin, label: "Location", value: career.location },
    { icon: LuClock, label: "Type", value: career.type },
    { icon: LuUsers, label: "Experience", value: career.experience },
    { icon: LuCalendar, label: "Apply by", value: formatDate(career.deadline) },
  ];
  return (
    <div className={`${bodyFont} text-neutral-800`}>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "JobPosting", title: career.title, description: career.title, employmentType: career.type.toUpperCase().replace(" ", "_"), validThrough: career.deadline, hiringOrganization: { "@type": "Organization", name: COMPANY.name }, jobLocation: { "@type": "Place", address: career.location } }} />
      <PageHero eyebrow={career.department} title={career.title} crumbs={[{ label: "Careers", href: "/careers" }, { label: career.title }]}>
        <ul className="flex flex-wrap gap-2.5" aria-label="Position details">
          <li><Tag tone="red">{career.type}</Tag></li><li><Tag tone="red">{career.location}</Tag></li><li><Tag tone="red">Apply by {formatDate(career.deadline)}</Tag></li>
        </ul>
      </PageHero>

      <section aria-label="Position" className="bg-white">
        <div className={`${container} grid items-start gap-12 py-9 md:py-12 lg:grid-cols-[1.4fr_0.6fr]`}>
          <Reveal variant="left">
            <h2 className={`${headingFont} mb-3 text-[28px] text-neutral-900`}>About the role</h2>
            <Prose html={career.descriptionHtml} />
            <h2 className={`${headingFont} mb-3 mt-10 text-[28px] text-neutral-900`}>What we are looking for</h2>
            <Prose html={career.requirementsHtml} />
          </Reveal>
          <Reveal variant="right" delay={120}>
            <aside aria-label="Position facts" className={`${card} bg-neutral-50 p-7 lg:sticky lg:top-[calc(var(--site-header-h)+24px)]`}>
              <ul className="space-y-4">
                {facts.map((f) => (
                  <li key={f.label} className="flex items-start gap-3"><f.icon className="mt-1 size-5 shrink-0 text-gold-700" aria-hidden /><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">{f.label}</p><p className="font-bold text-neutral-900">{f.value}</p></div></li>
                ))}
              </ul>
              <a href="#apply" className="mt-6 block rounded-xl bg-gold-500 px-6 py-3.5 text-center font-bold text-ink transition hover:bg-gold-400">Apply now</a>
            </aside>
          </Reveal>
        </div>
      </section>

      <section id="apply" aria-labelledby="apply-title" className="scroll-mt-[calc(var(--site-header-h)+8px)] bg-neutral-50">
        <div className={`${container} py-9 md:py-12`}>
          <div className={`${card} mx-auto max-w-3xl p-7 shadow-xl shadow-neutral-900/5 md:p-10`}>
            <h2 id="apply-title" className={`${headingFont} mb-2 text-[28px] text-neutral-900`}>Apply for this position</h2>
            <p className="mb-7 text-neutral-600">Tell us a little about yourself. Attaching a resume is optional.</p>
            <ApplyForm slug={career.slug} title={career.title} />
          </div>
        </div>
      </section>
    </div>
  );
}
