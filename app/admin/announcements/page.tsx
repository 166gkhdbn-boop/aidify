import { requireRole } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SetupRequired } from "@/components/setup-required";
import { Alert } from "@/components/ui";
import { listAnnouncementsAction } from "@/actions/admin";
import { PageHeader } from "../_components/page-header";
import { AnnouncementsClient } from "../_components/announcements-client";

export default async function AdminAnnouncementsPage() {
  if (!isSupabaseConfigured()) {
    return <SetupRequired feature="manage announcements" backHref="/admin" />;
  }
  await requireRole("administrator");

  const result = await listAnnouncementsAction();

  return (
    <div>
      <PageHeader
        title="Announcements"
        description="Broadcast messages to user dashboards. Drafts stay hidden until published."
      />
      {!result.ok ? (
        <Alert variant="error" title="Could not load announcements">
          {result.error.message}
        </Alert>
      ) : (
        <AnnouncementsClient initial={result.data} />
      )}
    </div>
  );
}
