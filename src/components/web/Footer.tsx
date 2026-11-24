import Link from "next/link";
import { FaArrowRight } from "react-icons/fa";
import { LuArrowUp, LuMail, LuMapPin, LuPhone } from "react-icons/lu";
import { COMPANY, CONTACT, FOOTER_COLUMNS } from "@/content/site";
import type { PublicSettings } from "@/server/services/public";
import { Logo } from "@/components/brand/Logo";

/**
 * Site footer: the logo, the contact details (address, phone, email from src/content/site.ts, CONTACT), the link columns and the copyright line.
 */
/** The contact number in international form without the plus sign, as WhatsApp links and phone links need it. */
const WHATSAPP_NUMBER = CONTACT.phone.replace(/\D/g, "");

export default function Footer(_props: { settings: PublicSettings }) {
  void _props; // the page layout still passes the settings; the footer reads CONTACT directly
  const year = new Date().getFullYear();
  return (
    <footer className="relative isolate overflow-hidden bg-neutral-950 text-white" aria-label="Site footer">
      <div aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-gold-400 to-transparent" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(55%_70%_at_90%_0%,rgba(176,128,64,0.28),transparent_62%),radial-gradient(45%_60%_at_0%_100%,rgba(176,128,64,0.14),transparent_62%)]" />
      <div aria-hidden className="about-grid absolute inset-0 -z-10 opacity-[0.05]" />
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-8 md:py-16 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[1.25fr_1fr_1fr] lg:gap-14">
          <div>
            <Link href="/" className="inline-flex items-center gap-3" aria-label="Hamsavahin Aarth Mines, home">
              <Logo variant="lockup" onDark className="h-20" />
            </Link>
            <address className="mt-7 max-w-sm space-y-4 text-[15px] not-italic text-white/80">
              <p className="flex gap-3.5"><span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gold-500/15 text-gold-300 ring-1 ring-gold-400/25"><LuMapPin className="size-[18px]" /></span><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONTACT.address)}`} target="_blank" rel="noopener noreferrer" className="pt-0.5 leading-6 transition-colors hover:text-white">{CONTACT.address}<span className="sr-only"> (opens in Google Maps)</span></a></p>
              <p className="flex items-center gap-3.5"><span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gold-500/15 text-gold-300 ring-1 ring-gold-400/25"><LuPhone className="size-[18px]" /></span><a href={`tel:+${WHATSAPP_NUMBER}`} className="transition-colors hover:text-white">{CONTACT.phone}</a></p>
              <p className="flex items-center gap-3.5"><span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gold-500/15 text-gold-300 ring-1 ring-gold-400/25"><LuMail className="size-[18px]" /></span><a href={`mailto:${CONTACT.email}`} className="break-all transition-colors hover:text-white">{CONTACT.email}</a></p>
            </address>
            <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hello, I would like to request a quote.")}`} target="_blank" rel="noopener noreferrer"
              className="btn-sheen group mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-gold-400 to-gold-500 px-6 py-3.5 text-[15px] font-bold text-ink shadow-lg shadow-gold-500/25 transition hover:-translate-y-0.5 hover:from-gold-300 hover:to-gold-400">
              Request a quote <FaArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" aria-hidden /><span className="sr-only"> (opens WhatsApp)</span>
            </a>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="mb-5 flex items-center gap-3 text-sm font-bold uppercase tracking-[0.2em] text-white">{col.title}<span aria-hidden className="h-px flex-1 bg-gradient-to-r from-gold-400/50 to-transparent" /></h2>
              <ul className="space-y-3">
                {col.links.map((l) => (
                  <li key={l.href + l.label}><Link href={l.href} className="group inline-flex items-center gap-2 text-[15px] leading-6 text-white/65 transition-all duration-300 hover:translate-x-1 hover:text-gold-200"><span aria-hidden className="size-1 rotate-45 bg-gold-500/60 transition-colors group-hover:bg-gold-300" />{l.label}</Link></li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-8 text-sm text-white/55 md:flex-row md:items-center">
          <p>{`© ${year} ${COMPANY.name}. All rights reserved.`}</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/privacy-policy" className="hover:text-white">Privacy policy</Link>
            <Link href="/terms" className="hover:text-white">Terms of use</Link>
            <Link href="/photo-credits" className="hover:text-white">Photo credits</Link>
            <a href="#top" className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-white/80 transition hover:border-gold-500 hover:bg-gold-500 hover:text-white">Back to top <LuArrowUp className="size-4" aria-hidden /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}
