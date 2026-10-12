import type { Metadata } from "next";
import Header from "@/components/web/Header";
import Footer from "@/components/web/Footer";
import "./globals.css";

/**
 * ROOT LAYOUT OF THE PUBLIC WEBSITE (served at "/").
 * Independent of the admin: its own <html>/<body>, its own stylesheet and its own metadata (indexable by search engines).
 * Nothing from the admin application is imported here, and the admin never imports from here.
 */
export const metadata: Metadata = {
  title: { default: "Hamsavahin", template: "%s | Hamsavahin" },
  description: "Global minerals, metals sourcing and trading company.",
};

export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
