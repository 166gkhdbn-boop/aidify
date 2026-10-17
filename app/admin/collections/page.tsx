import { requireRole } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SetupRequired } from "@/components/setup-required";
import { Alert } from "@/components/ui";
import { listCollectionsAdminAction } from "@/actions/admin";
import { PageHeader } from "../_components/page-header";
import { CollectionsTable } from "../_components/collections-table";

export default async function AdminCollectionsPage() {
  if (!isSupabaseConfigured()) {
    return <SetupRequired feature="browse collections" backHref="/admin" />;
  }
  await requireRole("administrator");

  const initial = await listCollectionsAdminAction({ page: 1, pageSize: 20 });

  return (
    <div>
      <PageHeader
        title="Collections"
        description="Every collection on the platform with its owner. Open a collection to see the configurations inside. Collections are read-only here — owners manage them from their own workspace."
      />
      {!initial.ok ? (
        <Alert variant="error" title="Could not load collections">
          {initial.error.message}
        </Alert>
      ) : (
        <CollectionsTable initial={initial.data} />
      )}
    </div>
  );
}
