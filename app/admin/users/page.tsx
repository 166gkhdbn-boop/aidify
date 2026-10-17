import { requireRole } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SetupRequired } from "@/components/setup-required";
import { Alert } from "@/components/ui";
import { listRolesAction } from "@/actions/admin";
import { listUsersAdmin, type UsersFilter } from "@/app/admin/_lib/queries";
import { PageHeader } from "../_components/page-header";
import { UsersTable } from "../_components/users-table";

export default async function AdminUsersPage() {
  if (!isSupabaseConfigured()) {
    return <SetupRequired feature="manage users" backHref="/admin" />;
  }
  await requireRole("administrator");

  const [usersRes, rolesRes] = await Promise.all([
    listUsersAdmin({ suspended: "all" } satisfies UsersFilter, { page: 1, pageSize: 20 }),
    listRolesAction(),
  ]);

  return (
    <div>
      <PageHeader
        title="Users"
        description="Search the user directory, filter by role or suspension status, and open a profile to manage roles or suspend the account."
      />
      {!usersRes.ok ? (
        <Alert variant="error" title="Could not load users">
          {usersRes.error.message}
        </Alert>
      ) : (
        <>
          <UsersTable initial={usersRes.data} roles={rolesRes.ok ? rolesRes.data : []} />
          <p className="mt-3 text-xs text-[var(--aidify-secondary)]">
            Search covers usernames and display names. Emails live in the auth
            directory and are shown per row but cannot be searched.
          </p>
        </>
      )}
    </div>
  );
}
