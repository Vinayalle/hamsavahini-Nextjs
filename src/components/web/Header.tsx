"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X, ArrowUpRight } from "lucide-react";

type MenuItem = {
  label: string;
  href?: string;
  children?: {
    label: string;
    href: string;
    description?: string;
  }[];
};

const menuItems: MenuItem[] = [
  {
    label: "About Us",
    children: [
      {
        label: "Company Overview",
        href: "/about",
        description: "Who we are and what we do",
      },
      {
        label: "Our Story",
        href: "/about/our-story",
        description: "Our journey and vision",
      },
      {
        label: "Quality & Compliance",
        href: "/quality-compliance",
        description: "Our quality standards",
      },
      {
        label: "Sustainability",
        href: "/sustainability",
        description: "Responsible business practices",
      },
    ],
  },

  {
    label: "Products",
    children: [
      {
        label: "All Products",
        href: "/products",
        description: "Explore our complete product portfolio",
      },
      {
        label: "Minerals",
        href: "/products/minerals",
        description: "Industrial and strategic minerals",
      },
      {
        label: "Metals",
        href: "/products/metals",
        description: "Metals for global industries",
      },
      {
        label: "Product Catalogue",
        href: "/products/catalogue",
        description: "Specifications and product documents",
      },
    ],
  },

  {
    label: "Live Commodity Desk",
    href: "/commodity-desk",
  },

  {
    label: "Global Operations",
    children: [
      {
        label: "Global Operations",
        href: "/global-operations",
        description: "Our global trade network",
      },
      {
        label: "Mines & Sourcing",
        href: "/global-operations/mines",
        description: "Our sourcing network",
      },
      {
        label: "Suppliers",
        href: "/global-operations/suppliers",
        description: "Trusted global suppliers",
      },
      {
        label: "Warehouses & Facilities",
        href: "/global-operations/facilities",
        description: "Our infrastructure",
      },
      {
        label: "Ports & Logistics",
        href: "/global-operations/logistics",
        description: "Global logistics network",
      },
    ],
  },

  {
    label: "Capabilities",
    children: [
      {
        label: "Our Capabilities",
        href: "/capabilities",
        description: "What we can deliver",
      },
      {
        label: "Procurement & Sourcing",
        href: "/capabilities/procurement",
        description: "Global procurement expertise",
      },
      {
        label: "Processing",
        href: "/capabilities/processing",
        description: "Processing and value addition",
      },
      {
        label: "Quality Assurance",
        href: "/capabilities/quality",
        description: "Quality control at every stage",
      },
      {
        label: "Supply Chain",
        href: "/capabilities/supply-chain",
        description: "End-to-end supply chain",
      },
    ],
  },

  {
    label: "Insights",
    children: [
      {
        label: "Insights",
        href: "/insights",
        description: "Industry insights and analysis",
      },
      {
        label: "Projects",
        href: "/projects",
        description: "Our projects and achievements",
      },
      {
        label: "Trade Stories",
        href: "/trade-stories",
        description: "Stories from our global trade",
      },
      {
        label: "Market Intelligence",
        href: "/insights/market-intelligence",
        description: "Market trends and intelligence",
      },
    ],
  },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const handleMenuToggle = (label: string) => {
    setOpenMenu(openMenu === label ? null : label);
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-neutral-200">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-10">
        <div className="flex h-[calc(var(--site-header-h)-1px)] items-center justify-between">

          {/* LOGO */}
          <Link
            href="/"
            className="flex items-center shrink-0"
            onClick={() => setMobileOpen(false)}
          >
            {/* <Image
              src="/logo.png"
              alt="Hamsavahin"
              width={180}
              height={60}
              className="h-auto w-[155px] object-contain"
              priority
            /> */}
            <h2>Hamsavahin</h2>
          </Link>

          {/* DESKTOP NAVIGATION */}
          <nav className="hidden lg:flex items-center gap-7 xl:gap-9">
            {menuItems.map((item) => (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() => {
                  if (item.children) {
                    setOpenMenu(item.label);
                  }
                }}
                onMouseLeave={() => {
                  if (item.children) {
                    setOpenMenu(null);
                  }
                }}
              >
                {item.children ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleMenuToggle(item.label)}
                      className="group flex items-center gap-1.5 text-[15px] font-medium text-neutral-800 transition-colors hover:text-red-600"
                    >
                      {item.label}

                      <ChevronDown
                        size={16}
                        strokeWidth={1.8}
                        className={`transition-transform duration-200 ${
                          openMenu === item.label ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {/* DROPDOWN */}
                    <div
                      className={`absolute left-1/2 top-full w-[320px] -translate-x-1/2 pt-5 transition-all duration-200 ${
                        openMenu === item.label
                          ? "visible translate-y-0 opacity-100"
                          : "invisible -translate-y-2 opacity-0"
                      }`}
                    >
                      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white p-2 shadow-[0_15px_50px_rgba(0,0,0,0.12)]">

                        {item.children.map((child) => (
                          <Link
                            key={child.label}
                            href={child.href}
                            className="group flex items-start justify-between rounded-lg px-4 py-3 transition-colors hover:bg-neutral-50"
                          >
                            <div>
                              <div className="text-sm font-semibold text-neutral-900 group-hover:text-red-600">
                                {child.label}
                              </div>

                              {child.description && (
                                <p className="mt-1 text-xs leading-5 text-neutral-500">
                                  {child.description}
                                </p>
                              )}
                            </div>

                            <ArrowUpRight
                              size={15}
                              className="mt-1 text-neutral-300 transition-colors group-hover:text-red-600"
                            />
                          </Link>
                        ))}

                      </div>
                    </div>
                  </>
                ) : (
                  <Link
                    href={item.href || "#"}
                    className="text-[15px] font-medium text-neutral-800 transition-colors hover:text-red-600"
                  >
                    {item.label}
                  </Link>
                )}
              </div>
            ))}
          </nav>

          {/* CONTACT BUTTON */}
          <div className="hidden lg:block">
            <Link
              href="/contact"
              className="group flex items-center gap-2 rounded-md border border-red-600 px-6 py-3 text-sm font-medium text-red-600 transition-all duration-300 hover:bg-red-600 hover:text-white"
            >
              Contact Us

              <ArrowUpRight
                size={16}
                className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </Link>
          </div>

          {/* MOBILE BUTTON */}
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-11 w-11 items-center justify-center rounded-md border border-neutral-200 text-neutral-800 lg:hidden"
          >
            {mobileOpen ? <X size={23} /> : <Menu size={23} />}
          </button>
        </div>
      </div>

      {/* MOBILE NAVIGATION */}
      <div
        className={`border-t border-neutral-200 bg-white lg:hidden ${
          mobileOpen ? "block" : "hidden"
        }`}
      >
        <div className="max-h-[calc(100svh-var(--site-header-h))] overflow-y-auto px-5 py-5">

          {menuItems.map((item) => (
            <div
              key={item.label}
              className="border-b border-neutral-100 last:border-0"
            >
              {item.children ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleMenuToggle(item.label)}
                    className="flex w-full items-center justify-between py-4 text-left text-[15px] font-medium text-neutral-900"
                  >
                    {item.label}

                    <ChevronDown
                      size={17}
                      className={`transition-transform ${
                        openMenu === item.label ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {openMenu === item.label && (
                    <div className="mb-3 rounded-lg bg-neutral-50 px-3 py-2">
                      {item.children.map((child) => (
                        <Link
                          key={child.label}
                          href={child.href}
                          onClick={() => setMobileOpen(false)}
                          className="block border-b border-neutral-200 py-3 last:border-0"
                        >
                          <div className="text-sm font-medium text-neutral-900">
                            {child.label}
                          </div>

                          {child.description && (
                            <p className="mt-1 text-xs text-neutral-500">
                              {child.description}
                            </p>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  href={item.href || "#"}
                  onClick={() => setMobileOpen(false)}
                  className="block py-4 text-[15px] font-medium text-neutral-900"
                >
                  {item.label}
                </Link>
              )}
            </div>
          ))}

          {/* MOBILE CONTACT */}
          <Link
            href="/contact"
            onClick={() => setMobileOpen(false)}
            className="mt-5 flex w-full items-center justify-center rounded-md bg-red-600 px-6 py-3.5 text-sm font-medium text-white"
          >
            Contact Us
          </Link>

        </div>
      </div>
    </header>
  );
}