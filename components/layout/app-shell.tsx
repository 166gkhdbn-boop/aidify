"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, Menu, X, Sparkles } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bell,
  Download,
  FileJson,
  FileJson2,
  FolderKanban,
  FolderOpen,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Lock,
  Megaphone,
  ScrollText,
  ServerCog,
  Settings,
  ShieldCheck,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Icon registry. Nav configs reference icons by NAME (string) because
 * Server Components cannot pass component references to Client Components
 * (React 19 serialization rules). Resolution happens here, inside the
 * client component.
 */
const NAV_ICONS: Record<string, LucideIcon> = {
  Activity,
  BarChart3,
  Bell,
  Download,
  FileJson,
  FileJson2,
  FolderKanban,
  FolderOpen,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Lock,
  Megaphone,
  ScrollText,
  ServerCog,
  Settings,
  ShieldCheck,
  User,
  Users,
};

/**
 * Main application shell: collapsible sidebar + topbar with slots for
 * search, notification bell, and account menu; mobile slide-over nav.
 *
 * Feature agents pass their own nav items:
 *   <AppShell nav={[{ href: "/app", label: "Dashboard", icon: "LayoutDashboard" }]}
 *             topbar={{ search: <…/>, notifications: <…/>, account: <…/> }}>
 *     {children}
 *   </AppShell>
 */

export interface NavItem {
  href: string;
  label: string;
  /** Lucide icon name, resolved via NAV_ICONS inside this client component. */
  icon: string;
  /** Optional badge content (e.g. unread count). */
  badge?: React.ReactNode;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export type NavEntry = NavItem | NavSection;

export function isNavSection(entry: NavEntry): entry is NavSection {
  return "items" in entry;
}

export interface AppShellProps {
  nav: NavEntry[];
  children: React.ReactNode;
  /** Slots rendered in the topbar. */
  topbar?: {
    search?: React.ReactNode;
    notifications?: React.ReactNode;
    account?: React.ReactNode;
  };
  /** Optional banner slot rendered between the topbar and the main content. */
  banner?: React.ReactNode;
  /** Brand name shown in the sidebar header. */
  brandName?: string;
  className?: string;
}

function NavList({
  nav,
  pathname,
  collapsed,
  onNavigate,
}: {
  nav: NavEntry[];
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Primary" className="flex flex-col gap-1 px-3">
      {nav.map((entry, i) =>
        isNavSection(entry) ? (
          <div key={`section-${entry.label}-${i}`} className="mt-4 first:mt-0">
            {!collapsed && (
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--aidify-secondary)]/70">
                {entry.label}
              </p>
            )}
            {entry.items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                pathname={pathname}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ) : (
          <NavLink
            key={entry.href}
            item={entry}
            pathname={pathname}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ),
      )}
    </nav>
  );
}

function NavLink({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const active = pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = NAV_ICONS[item.icon] ?? LayoutDashboard;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
        collapsed && "justify-center px-0",
        active
          ? "bg-gradient-to-r from-[var(--aidify-blue)]/25 to-[var(--aidify-violet)]/20 text-[var(--aidify-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_20px_rgba(67,139,255,0.15)] border border-[var(--aidify-border-strong)]"
          : "text-[var(--aidify-secondary)] hover:text-[var(--aidify-text)] hover:bg-white/[0.05] border border-transparent",
      )}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-[var(--aidify-cyan)] to-[var(--aidify-blue)]"
        />
      )}
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && item.badge && <span className="ml-auto">{item.badge}</span>}
    </Link>
  );
}

export function AppShell({
  nav,
  children,
  topbar,
  banner,
  brandName = "Aidify",
  className,
}: AppShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // Close the mobile drawer on route change (React's "adjust state during
  // render" pattern, so programmatic navigations also dismiss it).
  const [prevPathname, setPrevPathname] = React.useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
  }

  // Lock body scroll when the mobile drawer is open.
  React.useEffect(() => {
    if (!mobileOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <div className={cn("flex min-h-screen", className)}>
      {/* — Desktop sidebar — */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-[var(--aidify-border)] bg-[rgba(4,10,26,0.72)] backdrop-blur-xl transition-[width] duration-300 lg:flex",
          collapsed ? "w-[76px]" : "w-[264px]",
        )}
        aria-label="Sidebar"
      >
        <div className={cn("flex h-16 items-center gap-2.5 px-4", collapsed && "justify-center px-0")}>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--aidify-blue)] to-[var(--aidify-violet)] shadow-[0_0_20px_rgba(67,139,255,0.4)]">
            <Sparkles className="size-5 text-white" aria-hidden="true" />
          </div>
          {!collapsed && (
            <span className="truncate text-lg font-bold tracking-tight text-[var(--aidify-text)]">
              {brandName}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <NavList nav={nav} pathname={pathname ?? "/"} collapsed={collapsed} />
        </div>

        <div className="border-t border-[var(--aidify-border)] p-3">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm text-[var(--aidify-secondary)] transition-colors hover:bg-white/[0.05] hover:text-[var(--aidify-text)]"
          >
            {collapsed ? (
              <ChevronsRight className="size-5" aria-hidden="true" />
            ) : (
              <>
                <ChevronsLeft className="size-5" aria-hidden="true" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* — Mobile slide-over — */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[90] lg:hidden">
          <div
            className="absolute inset-0 bg-[#03050d]/80 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="absolute left-0 top-0 flex h-full w-[280px] flex-col border-r border-[var(--aidify-border)] bg-[rgba(4,10,26,0.95)] backdrop-blur-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <div className="flex h-16 items-center justify-between px-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--aidify-blue)] to-[var(--aidify-violet)]">
                  <Sparkles className="size-5 text-white" aria-hidden="true" />
                </div>
                <span className="text-lg font-bold text-[var(--aidify-text)]">{brandName}</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation menu"
                className="rounded-lg p-2 text-[var(--aidify-secondary)] hover:bg-white/[0.06] hover:text-[var(--aidify-text)]"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-4">
              <NavList
                nav={nav}
                pathname={pathname ?? "/"}
                collapsed={false}
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
          </aside>
        </div>
      )}

      {/* — Main column — */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[40] flex h-16 items-center gap-3 border-b border-[var(--aidify-border)] bg-[rgba(3,5,13,0.72)] px-4 backdrop-blur-xl lg:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            className="rounded-lg p-2 text-[var(--aidify-secondary)] hover:bg-white/[0.06] hover:text-[var(--aidify-text)] lg:hidden"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          {topbar?.search && <div className="min-w-0 flex-1">{topbar.search}</div>}
          <div className="ml-auto flex items-center gap-1.5">
            {topbar?.notifications}
            {topbar?.account}
          </div>
        </header>
        {banner}
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
