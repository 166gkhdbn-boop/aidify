import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getPublicSettings } from "@/lib/dal/settings";
import { AdminShell } from "@/components/layout/admin-shell";
import type { NavEntry } from "@/components/layout/app-shell";
import { AppBackground } from "@/components/app-background";
import { SetupRequired } from "@/components/setup-required";
import { AdminTopbar } from "./_components/admin-topbar";

export const metadata: Metadata = {
  title: "Admin console",
};

// Every /admin/* page requires the administrator role (requireRole), so
// static prerendering is impossible — opt out via connection()
// (cacheComponents mode does not allow the `dynamic` segment config).

const ADMIN_NAV: NavEntry[] = [
  {
    label: "Manage",
    items: [
      { href: "/admin", label: "Overview", icon: "LayoutDashboard" },
      { href: "/admin/users", label: "Users", icon: "Users" },
      { href: "/admin/configs", label: "Configurations", icon: "FileJson" },
      { href: "/admin/collections", label: "Collections", icon: "FolderOpen" },
      { href: "/admin/support", label: "Support", icon: "LifeBuoy" },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/admin/analytics", label: "Analytics", icon: "BarChart3" },
      { href: "/admin/reports", label: "Reports", icon: "Download" },
    ],
  },
  {
    label: "Governance",
    items: [
      { href: "/admin/audit-logs", label: "Audit Logs", icon: "ScrollText" },
      { href: "/admin/roles", label: "Roles", icon: "KeyRound" },
      { href: "/admin/permissions", label: "Permissions", icon: "Lock" },
      { href: "/admin/announcements", label: "Announcements", icon: "Megaphone" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/system", label: "System", icon: "ServerCog" },
      { href: "/admin/settings", label: "Settings", icon: "Settings" },
    ],
  },
];

/**
 * Admin area gate. requireRole("administrator") is the security boundary for
 * the whole /admin tree — but it is NOT the only one: every admin page also
 * calls requireRole() itself and every DAL function / server action enforces
 * the role server-side. Hiding UI is never treated as authorization.
 */
// Every /admin/* page requires the administrator role (requireRole), so these
// routes can never prerender — mark them blocking/dynamic (the cacheComponents
// replacement for `dynamic = "force-dynamic"`).
export const instant = false;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="relative min-h-screen">
        <AppBackground />
        <div className="relative">
          <SetupRequired feature="use the admin console" backHref="/" />
        </div>
      </div>
    );
  }

  const { user, roles } = await requireRole("administrator", "/admin");
  // site_name setting is wired into the shell brand (falls back to "Aidify").
  const settings = await getPublicSettings();

  return (
    <div className="relative min-h-screen">
      <AppBackground />
      <div className="relative">
        <AdminShell
          nav={ADMIN_NAV}
          brandName={settings.site_name}
          topbar={{
            account: (
              <AdminTopbar email={user.email ?? "admin"} roles={roles} />
            ),
          }}
        >
          {children}
        </AdminShell>
      </div>
    </div>
  );
}
