import type { ReactNode } from "react";
import { PageHero, bodyFont, container, headingFont } from "./ui";

/** Layout shared by the privacy policy and the terms of use. */
export function LegalPage({ title, intro, crumb, children }: { title: string; intro: string; crumb: string; children: ReactNode }) {
  return (
    <div className={`${bodyFont} text-neutral-800`}>
      <PageHero eyebrow="Legal" title={title} description={intro} crumbs={[{ label: crumb }]} />
      <article className="bg-white">
        <div className={`${container} py-14 md:py-20`}>
          <div className="mx-auto max-w-3xl space-y-10">{children}</div>
        </div>
      </article>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className={`${headingFont} mb-4 text-[26px] text-neutral-900`}>{title}</h2>
      <div className="space-y-4 text-base leading-8 text-neutral-700 md:text-lg md:leading-9 [&_a]:font-bold [&_a]:text-[var(--brand-red)] [&_a]:underline [&_li]:my-2 [&_ul]:list-disc [&_ul]:pl-6">{children}</div>
    </section>
  );
}
