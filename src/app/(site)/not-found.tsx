import Link from "next/link";
import { LuCompass } from "react-icons/lu";
import { ButtonLink, badge, bodyFont, container, headingFont } from "@/components/web/ui";
import { MINERALS } from "@/content/site";

export const metadata = { title: "Page not found", robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <div className={`${bodyFont} bg-neutral-50 text-neutral-800`}>
      <div className={`${container} flex min-h-[60svh] flex-col items-center justify-center py-12 text-center`}>
        <div aria-hidden className={`${badge} mb-6 size-20`}><LuCompass className="size-10" /></div>
        <p className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-gold-700">Error 404</p>
        <h1 className={`${headingFont} mb-4 text-[36px] text-neutral-900 md:text-[52px]`}>We could not find that page</h1>
        <p className="mb-8 max-w-xl text-lg leading-8 text-neutral-600">The page may have moved or the address may be mistyped. Try one of these instead.</p>
        <div className="flex flex-wrap justify-center gap-3"><ButtonLink href="/">Go to the home page</ButtonLink><ButtonLink href="/contact-us" variant="outline" arrow={false}>Contact us</ButtonLink></div>
        <ul className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-bold text-neutral-600" aria-label="Popular pages">
          <li><Link href="/about" className="hover:text-gold-700">About us</Link></li>
          <li><Link href="/minerals" className="hover:text-gold-700">Minerals</Link></li>
          <li><Link href="/industries" className="hover:text-gold-700">Industries</Link></li>
          <li><Link href="/products" className="hover:text-gold-700">Catalogue</Link></li>
          {MINERALS.slice(0, 1).map((m) => <li key={m.slug}><Link href={`/minerals/${m.slug}`} className="hover:text-gold-700">{m.name}</Link></li>)}
        </ul>
      </div>
    </div>
  );
}
