import { requireRole } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SetupRequired } from "@/components/setup-required";
import { Alert } from "@/components/ui";
import { listRolesWithMembersAction } from "@/actions/admin";
import { PageHeader } from "../_components/page-header";
import { RolesClient } from "../_components/roles-client";

export default async function AdminRolesPage() {
  if (!isSupabaseConfigured()) {
    return <SetupRequired feature="manage roles" backHref="/admin" />;
  }
  await requireRole("administrator");

  const rolesRes = await listRolesWithMembersAction();

  return (
    <div>
      <PageHeader
        title="Roles"
        description="The three platform roles and their members. Assign or change roles from a user's detail page; remove a single role from a member here."
      />
      {!rolesRes.ok ? (
        <Alert variant="error" title="Could not load roles">
          {rolesRes.error.message}
        </Alert>
      ) : (
        <RolesClient roles={rolesRes.data} />
      )}
    </div>
  );
}
