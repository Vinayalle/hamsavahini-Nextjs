"use client";

import { Suspense, createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { isApiMode } from "@/lib/api/client";
import { requirementForPath } from "@/lib/authz/catalog";
import { AccessDenied } from "./access-denied";
import { AdminSidebar } from "./sidebar";
import { AdminHeader } from "./header";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { NAV_GROUPS } from "@/config/navigation";
import { ConfirmProvider } from "./dialogs";
import { ReauthDialog } from "@/components/auth/reauth-dialog";

interface ShellState {
  collapsed: boolean;
  toggleCollapsed: () => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  crumb: { path: string; label: string } | null;
  setCrumb: (v: { path: string; label: string } | null) => void;
}

const ShellContext = createContext<ShellState | null>(null);
export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside AdminShell");
  return ctx;
}

const COLLAPSE_KEY = "hamsavahin.sidebar-collapsed";
const collapseListeners = new Set<() => void>();
function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, ready, can } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [crumb, setCrumb] = useState<{ path: string; label: string } | null>(null);
  const collapsed = useSyncExternalStore(
    (l) => {
      collapseListeners.add(l);
      return () => collapseListeners.delete(l);
    },
    readCollapsed,
    () => false,
  );

  useEffect(() => {
    if (ready && !user) router.replace("/admin/login");
  }, [ready, user, router]);

  useEffect(() => {
    // Close the mobile drawer after navigation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  const value = useMemo<ShellState>(
    () => ({
      collapsed,
      toggleCollapsed: () => {
        try {
          window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "0" : "1");
        } catch {
          /* ignore */
        }
        collapseListeners.forEach((l) => l());
      },
      mobileOpen,
      setMobileOpen,
      crumb,
      setCrumb,
    }),
    [collapsed, mobileOpen, crumb],
  );

  // Permission-aware navigation. Cosmetic only: the server (proxy + API) is what actually enforces access.
  const groups = useMemo(() => {
    const visible = (href: string) => {
      const req = requirementForPath(href.split("?")[0]);
      return req.kind === "open" || (req.kind === "permission" && can(req.resource, req.action));
    };
    return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.action || visible(i.href)) })).filter((g) => g.items.length > 0);
  }, [can]);

  const required = requirementForPath(pathname);
  const blocked = isApiMode && required.kind === "permission" && !can(required.resource, required.action);

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-muted" role="status">
        <Loader2 className="mr-2 size-5 animate-spin" aria-hidden /> Checking session…
      </div>
    );
  }

  return (
    <ShellContext.Provider value={value}>
      <ConfirmProvider>
      <ReauthDialog />
      <div className="flex min-h-screen">
        <aside
          className={`sticky top-0 hidden h-screen shrink-0 transition-[width] duration-150 lg:block ${collapsed ? "w-[72px]" : "w-64"}`}
        >
          <AdminSidebar collapsed={collapsed} groups={groups} />
        </aside>

        <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
          <DialogContent side="left" className="bg-navy-900 p-0" aria-describedby={undefined}>
            <DialogTitle className="sr-only">Navigation</DialogTitle>
            <AdminSidebar collapsed={false} groups={groups} />
          </DialogContent>
        </Dialog>

        <div className="flex min-w-0 flex-1 flex-col">
          <AdminHeader />
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8" id="main">
            <Suspense fallback={null}>{blocked ? <AccessDenied from={pathname} /> : children}</Suspense>
          </main>
        </div>
      </div>
      </ConfirmProvider>
    </ShellContext.Provider>
  );
}
