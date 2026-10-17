import { Megaphone } from "lucide-react";
import { getPublicSettings } from "@/lib/dal/settings";

/**
 * Announcement banner (server component). Renders the `announcement_banner`
 * system setting as a slim banner; renders nothing when the setting is empty.
 *
 * Integration (user app shell): mount <AnnouncementBanner /> at the top of
 * the shell layout, above the main content:
 *
 *   import { AnnouncementBanner } from "@/components/announcement-banner";
 *   ...
 *   <AnnouncementBanner />
 *   {children}
 *
 * The setting is edited on /admin/settings and cached for 60s.
 */
export async function AnnouncementBanner() {
  const settings = await getPublicSettings();
  const text = settings.announcement_banner;
  if (!text) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2.5 border-b border-[var(--aidify-blue)]/25 bg-[var(--aidify-blue)]/10 px-4 py-2 text-center"
    >
      <Megaphone className="size-4 shrink-0 text-[var(--aidify-cyan)]" aria-hidden="true" />
      <p className="text-xs font-medium text-[var(--aidify-text)] sm:text-sm">{text}</p>
    </div>
  );
}
