"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LuBell as Bell, LuChevronDown as ChevronDown, LuKeyRound as KeyRound, LuLoaderCircle as Loader2, LuLogOut as LogOut, LuMenu as Menu, LuPanelLeftClose as PanelLeftClose, LuPanelLeftOpen as PanelLeftOpen, LuCircleUser as UserCircle } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import {
  DropdownContent, DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator, DropdownTrigger,
} from "@/components/ui/dropdown";
import { apiFetch, isApiMode } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";
import { initials } from "@/lib/utils";
import { useAll } from "@/hooks/use-resource";
import { applicationService, enquiryService, rfqService } from "@/lib/services";
import { Breadcrumbs } from "./breadcrumbs";
import { GlobalSearch } from "./global-search";
import { useShell } from "./shell";

/** Database mode: the server counts what this employee may see (no tables are downloaded for a badge). */
function useAttention(): { rfqs: number; enquiries: number; applications: number } {
  const [counts, setCounts] = useState({ rfqs: 0, enquiries: 0, applications: 0 });
  useEffect(() => {
    let alive = true;
    const load = () => apiFetch<{ rfqs: number | null; enquiries: number | null; applications: number | null }>("/api/dashboard/attention")
      .then((r) => alive && setCounts({ rfqs: r.rfqs ?? 0, enquiries: r.enquiries ?? 0, applications: r.applications ?? 0 })).catch(() => undefined);
    void load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return counts;
}
function useMockAttention() {
  return {
    rfqs: useAll(rfqService).filter((r) => r.status === "new").length,
    enquiries: useAll(enquiryService).filter((e) => e.status === "new").length,
    applications: useAll(applicationService).filter((a) => a.status === "new").length,
  };
}
const useAttentionCounts = isApiMode ? useAttention : useMockAttention;

function NotificationsMenu() {
  const { rfqs, enquiries, applications } = useAttentionCounts();
  const total = rfqs + enquiries + applications;
  const rows = [
    { label: "New RFQs", count: rfqs, href: "/admin/rfqs" },
    { label: "New contact enquiries", count: enquiries, href: "/admin/enquiries" },
    { label: "New job applications", count: applications, href: "/admin/applications" },
  ];
  return (
    <DropdownMenu>
      <DropdownTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications (${total} items need attention)`}>
          <Bell className="size-[18px]" />
          {total > 0 && (
            <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-danger-600 text-[10px] font-semibold text-white">
              {total}
            </span>
          )}
        </Button>
      </DropdownTrigger>
      <DropdownContent className="w-72">
        <DropdownLabel>Needs attention</DropdownLabel>
        {rows.map((r) => (
          <DropdownItem key={r.href} asChild>
            <Link href={r.href} className="justify-between">
              <span>{r.label}</span>
              <span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-muted">{r.count}</span>
            </Link>
          </DropdownItem>
        ))}
        <DropdownSeparator />
        <DropdownItem asChild>
          <Link href="/admin/notifications/history">View notification history</Link>
        </DropdownItem>
      </DropdownContent>
    </DropdownMenu>
  );
}

export function AdminHeader() {
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();
  const { collapsed, toggleCollapsed, setMobileOpen } = useShell();
  if (!user) return null;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
          <Menu className="size-5" />
        </Button>
        <Button
          variant="ghost" size="icon" className="hidden lg:inline-flex"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
        </Button>

        <div className="hidden min-w-0 flex-1 md:block"><Breadcrumbs /></div>
        <div className="flex-1 md:hidden" />

        <GlobalSearch />
        <NotificationsMenu />

        <DropdownMenu>
          <DropdownTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2.5 rounded-lg p-1 pr-2 hover:bg-canvas"
              aria-label="Account menu"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-navy-800 text-xs font-semibold text-white">
                {initials(user.name)}
              </span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-[13px] font-medium text-ink">{user.name}</span>
                <span className="block text-[11px] text-muted">{user.role}</span>
              </span>
              <ChevronDown className="hidden size-4 text-muted sm:block" aria-hidden />
            </button>
          </DropdownTrigger>
          <DropdownContent className="w-56">
            <DropdownLabel>{user.email}</DropdownLabel>
            <DropdownItem asChild><Link href="/admin/profile"><UserCircle className="size-4" /> My Profile</Link></DropdownItem>
            <DropdownItem asChild><Link href="/admin/change-password"><KeyRound className="size-4" /> Change Password</Link></DropdownItem>
            <DropdownSeparator />
            <DropdownItem
              destructive
              disabled={signingOut}
              onSelect={(e) => {
                e.preventDefault(); // keep the menu open so "Signing out…" is visible until the page changes
                if (signingOut) return;
                setSigningOut(true);
                signOut().then(() => router.replace("/admin/login")).catch(() => setSigningOut(false));
              }}
            >
              {signingOut ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LogOut className="size-4" />} {signingOut ? "Signing out…" : "Log out"}
            </DropdownItem>
          </DropdownContent>
        </DropdownMenu>
      </div>
      <div className="border-t border-line px-4 py-2 md:hidden"><Breadcrumbs /></div>
    </header>
  );
}
