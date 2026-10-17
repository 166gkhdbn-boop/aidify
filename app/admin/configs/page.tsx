import { requireRole } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SetupRequired } from "@/components/setup-required";
import { Alert } from "@/components/ui";
import { moderateConfigsAction } from "@/actions/admin";
import { PageHeader } from "../_components/page-header";
import { ConfigsTable } from "../_components/configs-table";

/**
 * Configuration moderation. Moderators and administrators may inspect and
 * moderate any user's configuration (administrator implies moderator).
 */
export default async function AdminConfigsPage() {
  if (!isSupabaseConfigured()) {
    return <SetupRequired feature="moderate configurations" backHref="/admin" />;
  }
  await requireRole("moderator");

  const initial = await moderateConfigsAction({ page: 1, pageSize: 20 });

  return (
    <div>
      <PageHeader
        title="Configurations"
        description="Platform-wide configuration search. Open a configuration to inspect its metadata and masked data, then archive, restore, or delete it with a recorded reason."
      />
      {!initial.ok ? (
        <Alert variant="error" title="Could not load configurations">
          {initial.error.message}
        </Alert>
      ) : (
        <ConfigsTable initial={initial.data} />
      )}
    </div>
  );
}
