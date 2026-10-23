import { LuActivity as Activity, LuBadgeDollarSign as BadgeDollarSign, LuChartColumn as BarChart3, LuBoxes as Boxes, LuBriefcase as Briefcase, LuFileText as FileText, LuFolderKanban as FolderKanban, LuEarth as Globe2, LuImage as ImageIcon, LuImagePlus as ImagePlus, LuKeyRound as KeyRound, LuLayoutDashboard as LayoutDashboard, LuLibrary as Library, LuListTree as ListTree, LuLogOut as LogOut, LuMegaphone as Megaphone, LuMessageSquare as MessageSquare, LuNewspaper as Newspaper, LuPackage as Package, LuShieldCheck as ShieldCheck, LuHandshake as Handshake, LuClipboardList as ClipboardList, LuCircleUser as UserCircle, LuUsers as Users, LuBell as Bell } from "react-icons/lu";
import type { IconType } from "react-icons";

export interface NavItem {
  label: string;
  href: string;
  icon: IconType;
  /** Marks the Logout entry: it signs out, then lands on /admin/login. */
  action?: "logout";
  keywords?: string[];
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  { title: "Overview", items: [
    { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  ] },
  { title: "Product Catalogue", items: [
    { label: "All Products", href: "/admin/products", icon: Package },
    { label: "Categories", href: "/admin/categories", icon: ListTree },
    { label: "Product Specifications", href: "/admin/specifications", icon: ClipboardList },
    { label: "Product Images", href: "/admin/product-images", icon: ImageIcon },
    { label: "Product Documents", href: "/admin/product-documents", icon: FileText },
  ] },
  { title: "Content Management", items: [
    { label: "Posts / Insights", href: "/admin/posts", icon: Newspaper },
    { label: "Projects / Trade Stories", href: "/admin/projects", icon: FolderKanban },
    { label: "Careers & Job Openings", href: "/admin/careers", icon: Briefcase },
    { label: "Global Operations / Locations", href: "/admin/locations", icon: Globe2 },
    { label: "Banners", href: "/admin/banners", icon: Megaphone },
  ] },
  { title: "Trade Management", items: [
    { label: "Commodities", href: "/admin/commodities", icon: Boxes },
    { label: "Commodity Prices", href: "/admin/commodity-prices", icon: BadgeDollarSign },
    { label: "Trade Opportunities", href: "/admin/trade-opportunities", icon: Handshake },
    { label: "RFQs & Trade Enquiries", href: "/admin/rfqs", icon: BarChart3 },
  ] },
  { title: "Website Enquiries", items: [
    { label: "Contact Enquiries", href: "/admin/enquiries", icon: MessageSquare },
    { label: "Job Applications", href: "/admin/applications", icon: Users },
  ] },
  { title: "Media & Documents", items: [
    { label: "Media Library", href: "/admin/media", icon: ImagePlus },
    { label: "Document Library", href: "/admin/documents", icon: Library },
  ] },
  { title: "Notifications", items: [
    { label: "Notification History", href: "/admin/notifications/history", icon: Bell },
  ] },
  { title: "Administration", items: [
    { label: "Admin Users", href: "/admin/users", icon: Users },
    { label: "Roles & Permissions", href: "/admin/roles", icon: ShieldCheck },
    { label: "Activity Logs", href: "/admin/activity-logs", icon: Activity },
  ] },
  { title: "Account", items: [
    { label: "My Profile", href: "/admin/profile", icon: UserCircle },
    { label: "Change Password", href: "/admin/change-password", icon: KeyRound },
    { label: "Logout", href: "/admin/login", icon: LogOut, action: "logout" },
  ] },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items.filter((i) => !i.action));

/** Human labels for URL segments that are not nav items (dynamic/action routes). */
export const SEGMENT_LABELS: Record<string, string> = {
  admin: "Admin",
  new: "Add new",
  edit: "Edit",
  history: "History",
  notifications: "Notifications",
};

export function findNavLabel(href: string): string | undefined {
  return ALL_NAV_ITEMS.find((i) => i.href === href)?.label;
}

