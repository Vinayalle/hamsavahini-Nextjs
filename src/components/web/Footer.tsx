import Link from "next/link";
import { LuArrowUp } from "react-icons/lu";
// import { LuMail, LuMapPin, LuPhone } from "react-icons/lu"; // used by the contact details block below (currently commented out)
import { COMPANY, FOOTER_COLUMNS } from "@/content/site";
import type { PublicSettings } from "@/server/services/public";
import { ButtonLink } from "./ui";
import { Logo } from "@/components/brand/Logo";

/**
 * Site footer. The "about" text and the copyright line are fixed text. The contact details block (address, phone, email from
 * src/content/site.ts, CONTACT) is commented out below, so the footer currently shows no contact details.
 */
// `settings` carries the contact details; it is only read by the commented-out block below.
export default function Footer(_props: { settings: PublicSettings }) {
  void _props; // keeps the prop for when the contact block below is switched back on
  const year = new Date().getFullYear();
  // const hasContact = !!(settings.address || settings.phone || settings.email);
  return (
    <footer className="bg-neutral-950 text-white" aria-label="Site footer">
      <div className="mx-auto max-w-[1200px] px-5 py-9 sm:px-8 md:py-12 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_2.7fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-3" aria-label="Hamsavahin Aarth Mines, home">
              <Logo variant="lockup" className="h-12" />
            </Link>
            <p className="mt-5 max-w-sm text-[15px] leading-7 text-white/70">{COMPANY.description}</p>
            {/* Contact details (address, phone, email): hidden for now. Remove this comment to show them again.
            {hasContact && (
              <address className="mt-6 space-y-3 text-[15px] not-italic text-white/80">
                {settings.address && <p className="flex gap-3"><LuMapPin className="mt-1 size-4 shrink-0 text-gold-300" aria-hidden /><span className="whitespace-pre-line">{settings.address}</span></p>}
                {settings.phone && <p className="flex gap-3"><LuPhone className="mt-1 size-4 shrink-0 text-gold-300" aria-hidden /><a href={`tel:${settings.phone.replace(/[^+\d]/g, "")}`} className="hover:text-white">{settings.phone}</a></p>}
                {settings.email && <p className="flex gap-3"><LuMail className="mt-1 size-4 shrink-0 text-gold-300" aria-hidden /><a href={`mailto:${settings.email}`} className="break-all hover:text-white">{settings.email}</a></p>}
              </address>
            )}
            */}
            <div className="mt-8"><ButtonLink href="/contact-us" variant="outline" className="!border-white/40 !text-white hover:!bg-white hover:!text-neutral-900">Get in touch</ButtonLink></div>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title}>
                <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-white">{col.title}</h2>
                <ul className="space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.href + l.label}><Link href={l.href} className="text-[15px] leading-6 text-white/65 transition-colors hover:text-white">{l.label}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-8 text-sm text-white/55 md:flex-row md:items-center">
          <p>{`© ${year} ${COMPANY.name}. All rights reserved.`}</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/privacy-policy" className="hover:text-white">Privacy policy</Link>
            <Link href="/terms" className="hover:text-white">Terms of use</Link>
            <a href="#top" className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-white/80 transition hover:border-gold-500 hover:bg-gold-500 hover:text-white">Back to top <LuArrowUp className="size-4" aria-hidden /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}
