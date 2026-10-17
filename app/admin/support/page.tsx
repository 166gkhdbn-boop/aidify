import { requireRole } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SetupRequired } from "@/components/setup-required";
import { Alert } from "@/components/ui";
import { getSystemSettingsAction, listSupportTicketsAction } from "@/actions/admin";
import { PageHeader } from "../_components/page-header";
import { SupportQueueClient } from "../_components/support-queue-client";

/**
 * Staff support queue (moderator+). The support_email setting is surfaced
 * here so staff know the public contact address.
 */
export default async function AdminSupportPage() {
  if (!isSupabaseConfigured()) {
    return <SetupRequired feature="work the support queue" backHref="/admin" />;
  }
  await requireRole("moderator");

  const [ticketsRes, settingsRes] = await Promise.all([
    listSupportTicketsAction(null, { page: 1, pageSize: 20 }),
    getSystemSettingsAction(),
  ]);

  const supportEmail =
    settingsRes.ok && typeof settingsRes.data.support_email === "string"
      ? settingsRes.data.support_email
      : null;

  return (
    <div>
      <PageHeader
        title="Support"
        description="Triage the support queue: open a ticket to read the thread, reply as staff, and move it through its statuses."
      />
      {!ticketsRes.ok ? (
        <Alert variant="error" title="Could not load tickets">
          {ticketsRes.error.message}
        </Alert>
      ) : (
        <SupportQueueClient initial={ticketsRes.data} supportEmail={supportEmail} />
      )}
    </div>
  );
}
