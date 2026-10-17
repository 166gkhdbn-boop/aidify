import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SetupRequired } from "@/components/setup-required";
import { AppShell, type NavEntry } from "@/components/layout/app-shell";
import { AppBackground } from "@/components/app-background";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { getProfile } from "@/lib/dal/profile";
import { GlobalSearch } from "./_components/global-search";
import { NotificationBell } from "./_components/notification-bell";
import { AccountMenu } from "./_components/account-menu";
import { NotificationsNavBadge } from "./_components/notifications-nav-badge";

export const metadata: Metadata = {
  title: "App",
};

const NAV: NavEntry[] = [
  { href: "/app", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/app/configs", label: "Configurations", icon: "FileJson2" },
  { href: "/app/collections", label: "Collections", icon: "FolderKanban" },
  { href: "/app/analytics", label: "Analytics", icon: "BarChart3" },
  { href: "/app/activity", label: "Activity", icon: "Activity" },
  {
    href: "/app/notifications",
    label: "Notifications",
    icon: "Bell",
    badge: <NotificationsNavBadge />,
  },
  { href: "/app/support", label: "Support", icon: "LifeBuoy" },
  {
    label: "Account",
    items: [
      { href: "/app/profile", label: "Profile", icon: "User" },
      { href: "/app/security", label: "Security", icon: "ShieldCheck" },
      { href: "/app/settings", label: "Settings", icon: "Settings" },
    ],
  },
];

/**
 * User-app layout: authenticated shell (sidebar + topbar) behind the cosmic
 * background. Every /app/* page inherits requireUser() from here.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) {
    return <SetupRequired feature="use the Aidify app" backHref="/" />;
  }

  const user = await requireUser("/app");

  // Profile powers the account menu avatar; failure is non-fatal.
  const profileRes = await getProfile();
  const profile = profileRes.ok ? profileRes.data : null;

  return (
    <>
      <AppBackground />
      <AppShell
        nav={NAV}
        banner={<AnnouncementBanner />}
        topbar={{
          search: <GlobalSearch />,
          notifications: <NotificationBell />,
          account: (
            <AccountMenu
              email={user.email ?? null}
              displayName={profile?.display_name ?? null}
              avatarUrl={profile?.avatar_url ?? null}
            />
          ),
        }}
      >
        {children}
      </AppShell>
    </>
  );
}
