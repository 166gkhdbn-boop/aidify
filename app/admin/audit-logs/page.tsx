import { requireRole } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SetupRequired } from "@/components/setup-required";
import { Alert } from "@/components/ui";
import { listAuditActionTypesAction } from "@/actions/admin";
import { listAuditLogsAdmin } from "@/app/admin/_lib/queries";
import { PageHeader } from "../_components/page-header";
import { AuditLogsClient } from "../_components/audit-logs-client";

export default async function AdminAuditLogsPage() {
  if (!isSupabaseConfigured()) {
    return <SetupRequired feature="view audit logs" backHref="/admin" />;
  }
  await requireRole("administrator");

  const [logsRes, typesRes] = await Promise.all([
    listAuditLogsAdmin({}, { page: 1, pageSize: 20 }),
    listAuditActionTypesAction(),
  ]);

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="Every privileged action on the platform — who did it, what they touched, and why. Expand an entry to inspect its metadata."
      />
      {!logsRes.ok ? (
        <Alert variant="error" title="Could not load audit logs">
          {logsRes.error.message}
        </Alert>
      ) : (
        <AuditLogsClient
          initial={logsRes.data}
          actionTypes={typesRes.ok ? typesRes.data : []}
        />
      )}
    </div>
  );
}
