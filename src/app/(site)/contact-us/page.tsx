import { LuClock, LuMail, LuMapPin, LuPhone } from "react-icons/lu";
import { ContactForm } from "@/components/web/forms";
import { Reveal } from "@/components/web/motion";
import { ButtonLink, PageHero, badge, bodyFont, card, container, headingFont } from "@/components/web/ui";
import { pageMeta, prefill } from "@/content/seo";
import { getSiteSettings } from "@/server/services/public";

export const metadata = pageMeta("Contact us", "Send us your requirement or question. Our team replies to every enquiry.", "/contact-us");

export default async function ContactPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [settings, sp] = await Promise.all([getSiteSettings(), searchParams]);
  const rows = [
    settings.address && { icon: LuMapPin, label: "Office", node: <span className="whitespace-pre-line">{settings.address}</span> },
    settings.phone && { icon: LuPhone, label: "Phone", node: <a href={`tel:${settings.phone.replace(/[^+\d]/g, "")}`} className="font-bold text-neutral-900 hover:text-gold-700">{settings.phone}</a> },
    settings.email && { icon: LuMail, label: "Email", node: <a href={`mailto:${settings.email}`} className="break-all font-bold text-neutral-900 hover:text-gold-700">{settings.email}</a> },
  ].filter((r): r is Exclude<typeof r, ""> => !!r);

  return (
    <div className={`${bodyFont} text-neutral-800`}>
      <PageHero eyebrow="Get in touch" title="Contact us" description="Tell us what you are looking for. Every enquiry is read by a person on our team, and we reply by email." crumbs={[{ label: "Contact us" }]} />
      <section aria-label="Contact" className="bg-neutral-50">
        <div className={`${container} grid items-start gap-10 py-9 md:py-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14`}>
          <Reveal variant="left" className="space-y-5">
            <div className={`${card} p-7 md:p-8`}>
              <h2 className={`${headingFont} mb-5 text-2xl text-neutral-900`}>How to reach us</h2>
              {rows.length > 0 ? (
                <ul className="space-y-5">
                  {rows.map((r) => (
                    <li key={r.label} className="flex gap-4">
                      <span aria-hidden className={`${badge} size-11 !rounded-xl`}><r.icon className="size-5" /></span>
                      <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-500">{r.label}</p><p className="mt-1 text-neutral-700">{r.node}</p></div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="leading-7 text-neutral-600">Use the form and we will reply to the email address you give us.</p>
              )}
            </div>
            <div className={`${card} flex gap-4 p-7 md:p-8`}>
              <span aria-hidden className={`${badge} size-11 shrink-0 !rounded-xl`}><LuClock className="size-5" /></span>
              <div>
                <h3 className="font-bold text-neutral-900">Looking for a price?</h3>
                <p className="mt-1 text-neutral-600">For quantities, grades and delivery terms, the quotation form gets you the fastest answer.</p>
                <div className="mt-4"><ButtonLink href="/request-a-quote" variant="outline">Request a quote</ButtonLink></div>
              </div>
            </div>
          </Reveal>
          <Reveal variant="right" delay={120}>
            <div className={`${card} p-7 shadow-xl shadow-neutral-900/5 md:p-10`}>
              <h2 className={`${headingFont} mb-6 text-2xl text-neutral-900 md:text-3xl`}>Send us a message</h2>
              <ContactForm defaultSubject={prefill(sp.subject)} />
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
