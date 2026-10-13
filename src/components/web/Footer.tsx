"use client";

import Link from "next/link";
import { LuArrowUp as ArrowUp, LuMapPin as MapPin, LuPhone as Phone, LuMail as Mail } from "react-icons/lu";

const footerSections = [
  {
    title: "Company",
    links: [
      { label: "Home", href: "/" },
      { label: "About Us", href: "/about-us" },
      { label: "Global Operations", href: "/global-operations" },
      { label: "Our Capabilities", href: "/our-capabilities" },
      { label: "Careers", href: "/careers" },
    ],
  },
  {
    title: "Products & Trading",
    links: [
      { label: "Products", href: "/products" },
      { label: "Live Commodity Desk", href: "/live-commodity-desk" },
      { label: "Projects / Trade Stories", href: "/projects" },
      { label: "Insights", href: "/insights" },
    ],
  },
  {
    title: "Quality & Responsibility",
    links: [
      { label: "Quality & Compliance", href: "/quality-compliance" },
      { label: "Sustainability", href: "/sustainability" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-[#211f20] w-full text-white">
      {/* Contact CTA */}
      <div className="mx-auto max-w-7xl px-5 pt-14 pb-12 md:px-10 lg:px-12">
        <div className="flex flex-col justify-between gap-7 border-b border-white/15 pb-12 md:flex-row md:items-center">
          <div>
            <h2 className="max-w-2xl text-3xl font-semibold leading-tight md:text-4xl">
              Partner With Us for Superior
              <br className="hidden md:block" /> Mineral Sourcing
            </h2>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-300 md:text-base">
              Connecting global industries with quality minerals,
              reliable sourcing, and responsible supply chain solutions.
            </p>
          </div>

          <Link
            href="/contact-us"
            className="inline-flex w-fit shrink-0 items-center justify-center rounded-lg border border-red-500 bg-white px-7 py-3 text-sm font-medium text-red-600 transition hover:bg-red-600 hover:text-white"
          >
            Get in touch
          </Link>
        </div>

        {/* Footer columns */}
        <div className="grid grid-cols-1 gap-10 py-12 sm:grid-cols-2 lg:grid-cols-5 lg:gap-8">
          {/* Company information */}
          <div className="lg:col-span-2">
            <Link
              href="/"
              className="inline-block text-3xl font-bold tracking-tight"
            >
              <span className="text-red-500">D</span>akshināk
            </Link>

            <p className="mt-4 max-w-sm text-sm leading-6 text-gray-300">
              Your trusted partner for mineral sourcing, global commodity
              trading, and dependable industrial supply solutions.
            </p>

            <div className="mt-7 space-y-5 text-sm text-gray-200">
              <div className="flex items-start gap-3">
                <MapPin
                  size={19}
                  className="mt-1 shrink-0 text-red-400"
                />
                <p className="leading-6">
                  Add your registered office address here.
                </p>
              </div>

              <a
                href="tel:+919000000000"
                className="flex items-center gap-3 transition hover:text-red-400"
              >
                <Phone size={18} className="shrink-0 text-red-400" />
                +91 90000 00000
              </a>

              <a
                href="mailto:info@example.com"
                className="flex items-center gap-3 transition hover:text-red-400"
              >
                <Mail size={18} className="shrink-0 text-red-400" />
                info@example.com
              </a>
            </div>
          </div>

          {/* Navigation groups */}
          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="mb-5 text-base font-semibold">
                {section.title}
              </h3>

              <ul className="space-y-4">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-300 transition hover:text-red-400"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Contact navigation */}
          <div className="lg:col-span-1">
            <h3 className="mb-5 text-base font-semibold">Connect With Us</h3>

            <p className="text-sm leading-6 text-gray-300">
              Have a sourcing requirement or a business enquiry?
              Our team is ready to assist.
            </p>

            <Link
              href="/contact-us"
              className="mt-5 inline-block text-sm font-medium text-red-400 transition hover:text-white"
            >
              Contact Us →
            </Link>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col justify-between gap-4 border-t border-white/15 pt-6 text-sm text-gray-400 md:flex-row md:items-center">
          <p>
            © {new Date().getFullYear()} Dakshināk. All rights reserved.
          </p>

          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Link
              href="/privacy-policy"
              className="transition hover:text-white"
            >
              Privacy Policy
            </Link>

            <Link
              href="/terms-and-conditions"
              className="transition hover:text-white"
            >
              Terms & Conditions
            </Link>

            <Link href="/contact-us" className="transition hover:text-white">
              Contact Us
            </Link>
          </div>

          <button
            type="button"
            onClick={() =>
              window.scrollTo({ top: 0, behavior: "smooth" })
            }
            aria-label="Back to top"
            className="flex h-10 w-10 items-center justify-center self-start rounded-md bg-white/5 transition hover:bg-red-600 hover:text-white md:self-auto"
          >
            <ArrowUp size={20} />
          </button>
        </div>
      </div>
    </footer>
  );
}