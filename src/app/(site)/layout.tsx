import type { Metadata, Viewport } from "next";
import Header from "@/components/web/Header";
import Footer from "@/components/web/Footer";
import { JsonLd } from "@/components/web/ui";
import { COMPANY } from "@/content/site";
import { BRAND } from "@/config/brand";
import { getSiteSettings } from "@/server/services/public";
import "./globals.css";

/**
 * ROOT LAYOUT OF THE PUBLIC WEBSITE (served at "/").
 * Independent of the admin: its own <html>/<body>, its own stylesheet and its own metadata (indexable by search engines).
 * Nothing from the admin application is imported here, and the admin never imports from here.
 *
 * Pages are rendered on every request (the content comes from the admin CMS and must be current), and always send their complete HTML.
 */
export const dynamic = "force-dynamic";

const base = (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(base),
  title: { default: `${COMPANY.name} | Global mineral sourcing and trading`, template: `%s | ${COMPANY.short}` },
  description: COMPANY.description,
  applicationName: COMPANY.name,
  openGraph: { type: "website", siteName: COMPANY.name, title: COMPANY.name, description: COMPANY.description, locale: "en_IN", images: [{ url: BRAND.shareImage, width: 1200, height: 630, alt: COMPANY.name }] },
  twitter: { card: "summary_large_image", title: COMPANY.name, description: COMPANY.description, images: [BRAND.shareImage] },
  alternates: { canonical: "./" },
};
export const viewport: Viewport = { themeColor: BRAND.colors.gold, width: "device-width", initialScale: 1 };

export default async function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await getSiteSettings();
  return (
    <html lang="en">
      <body id="top">
        <JsonLd
          data={{
            "@context": "https://schema.org", "@type": "Organization", name: COMPANY.name, url: base, description: COMPANY.description,
            ...(settings.email || settings.phone ? { contactPoint: { "@type": "ContactPoint", contactType: "sales", ...(settings.email ? { email: settings.email } : {}), ...(settings.phone ? { telephone: settings.phone } : {}) } } : {}),
          }}
        />
        <Header />
        <main id="main" className="overflow-x-clip">{children}</main>
        <Footer settings={settings} />
      </body>
    </html>
  );
}
