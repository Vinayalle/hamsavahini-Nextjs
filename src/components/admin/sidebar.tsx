"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LuChevronDown as ChevronDown, LuLoaderCircle as Loader2, LuWaves as Waves } from "react-icons/lu";
import { cn } from "@/lib/utils";
import type { NavGroup, NavItem } from "@/config/navigation";
import { useAuth } from "@/lib/auth";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar({ collapsed, groups }: { collapsed: boolean; groups: NavGroup[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [signingOut, setSigningOut] = useState(false);

  const handleLogout = () => {
    if (signingOut) return;
    setSigningOut(true);
    // Wait for the server to revoke the session before leaving, so the login page cannot silently restore it.
    signOut().then(() => router.replace("/admin/login")).catch(() => setSigningOut(false));
  };

  const renderItem = (item: NavItem) => {
    const active = !item.action && isActive(pathname, item.href);
    const cls = cn(
      "group relative flex items-center gap-3 rounded-md px-3 py-2 text-[13.5px] transition-colors",
      collapsed && "justify-center px-0",
      active ? "bg-white/10 font-medium text-white" : "text-slate-300 hover:bg-white/5 hover:text-white",
    );
    const inner = (
      <>
        {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-brand-500" aria-hidden />}
        {item.action === "logout" && signingOut ? <Loader2 className="size-[18px] shrink-0 animate-spin" aria-hidden /> : <item.icon className="size-[18px] shrink-0" aria-hidden />}
        <span className={cn("truncate", collapsed && "sr-only")}>{item.action === "logout" && signingOut ? "Signing out…" : item.label}</span>
      </>
    );
    return (
      <li key={item.label}>
        {item.action === "logout" ? (
          <button type="button" onClick={handleLogout} disabled={signingOut} aria-busy={signingOut || undefined} className={cn(cls, "w-full text-left")} title={collapsed ? item.label : undefined}>
            {inner}
          </button>
        ) : (
          <Link href={item.href} className={cls} aria-current={active ? "page" : undefined} title={collapsed ? item.label : undefined}>
            {inner}
          </Link>
        )}
      </li>
    );
  };

  return (
    <nav aria-label="Main navigation" className="flex h-full flex-col bg-navy-900 text-slate-200">
      <div className={cn("flex h-16 shrink-0 items-center gap-2.5 border-b border-white/10 px-5", collapsed && "justify-center px-0")}>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
          <Waves className="size-[18px]" aria-hidden />
        </span>
        {!collapsed && (
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight text-white">Hamsavahin</div>
            <div className="text-[11px] text-slate-400">Super Admin</div>
          </div>
        )}
      </div>

      <div className="scroll-thin flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {groups.map((group) => {
          const hasActive = group.items.some((i) => !i.action && isActive(pathname, i.href));
          const open = collapsed || hasActive || !closed[group.title];
          return (
            <div key={group.title} className="pb-2">
              {collapsed ? (
                <div className="mx-2 mb-1 h-px bg-white/10" aria-hidden />
              ) : (
                <button
                  type="button"
                  onClick={() => setClosed((c) => ({ ...c, [group.title]: !c[group.title] }))}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200"
                >
                  {group.title}
                  <ChevronDown className={cn("size-3.5 transition-transform", !open && "-rotate-90")} aria-hidden />
                </button>
              )}
              {open && <ul className="mt-0.5 space-y-0.5">{group.items.map(renderItem)}</ul>}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
