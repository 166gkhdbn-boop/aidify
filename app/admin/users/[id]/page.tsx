import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileJson } from "lucide-react";
import { getSessionUser, requireRole } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SetupRequired } from "@/components/setup-required";
import {
  Alert,
  Avatar,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { getUserDetailAction } from "@/actions/admin";
import { getUserSuspension, listRoles } from "@/app/admin/_lib/queries";
import { PageHeader } from "../../_components/page-header";
import { StatCard } from "../../_components/stat-card";
import { RoleManager } from "../../_components/role-manager";
import { UserActions } from "../../_components/user-actions";
import { formatDate, formatDateTime, timeAgo } from "../../_lib/format";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured()) {
    return <SetupRequired feature="view user details" backHref="/admin/users" />;
  }
  await requireRole("administrator");
  const { id } = await params;

  const me = await getSessionUser();
  const [detailRes, suspensionRes, rolesRes] = await Promise.all([
    getUserDetailAction(id),
    getUserSuspension(id),
    listRoles(),
  ]);

  if (!detailRes.ok) {
    if (detailRes.error.code === "NOT_FOUND" || detailRes.error.code === "VALIDATION") {
      notFound();
    }
    return (
      <div>
        <PageHeader title="User" />
        <Alert variant="error" title="Could not load user">
          {detailRes.error.message}
        </Alert>
      </div>
    );
  }

  const user = detailRes.data;
  const suspension = suspensionRes.ok ? suspensionRes.data : { email: null, suspended: false, bannedUntil: null };
  const isSelf = me?.id === user.id;

  return (
    <div>
      <Link
        href="/admin/users"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--aidify-secondary)] transition-colors hover:text-[var(--aidify-text)]"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to users
      </Link>

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center gap-5 p-6">
          <Avatar
            src={user.avatar_url}
            alt={user.username}
            fallback={(user.username.charAt(0) || "?").toUpperCase()}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-[var(--aidify-text)]">
                {user.display_name ?? user.username}
              </h1>
              {suspension.suspended ? (
                <Badge variant="error">Suspended</Badge>
              ) : (
                <Badge variant="success">Active</Badge>
              )}
              {isSelf && <Badge variant="info">This is you</Badge>}
            </div>
            <p className="mt-1 text-sm text-[var(--aidify-secondary)]">
              @{user.username}
              {suspension.email ? ` · ${suspension.email}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {user.roles.length === 0 ? (
                <Badge variant="muted">user</Badge>
              ) : (
                user.roles.map((r) => (
                  <Badge
                    key={r}
                    variant={r === "administrator" ? "error" : r === "moderator" ? "violet" : "muted"}
                  >
                    {r}
                  </Badge>
                ))
              )}
            </div>
            <p className="mt-2 text-xs text-[var(--aidify-secondary)]">
              Joined {formatDate(user.created_at)}
              {user.recentActivity[0]
                ? ` · last activity ${timeAgo(user.recentActivity[0].created_at)}`
                : " · no recorded activity"}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Configurations" value={user.configs.total} icon={FileJson} subtitle={`${user.configs.active} active · ${user.configs.archived} archived · ${user.configs.draft} draft`} />
        <StatCard label="Recent actions" value={user.recentActivity.length} subtitle="Latest activity log entries (max 10 shown)" />
        <StatCard label="Security events" value={user.recentSecurityEvents.length} subtitle="Latest security events (max 10 shown)" />
        <StatCard
          label="Account state"
          value={suspension.suspended ? "Suspended" : "Active"}
          subtitle={
            suspension.suspended && suspension.bannedUntil
              ? `Banned until ${formatDateTime(suspension.bannedUntil)}`
              : "No active suspension"
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Role management</CardTitle>
            <CardDescription>
              Assign or remove roles. Every change requires a reason and is written to the audit log.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rolesRes.ok ? (
              <RoleManager
                userId={user.id}
                username={user.username}
                currentRoleNames={user.roles}
                allRoles={rolesRes.data}
                isSelf={isSelf}
              />
            ) : (
              <Alert variant="error" title="Could not load roles">
                {rolesRes.error.message}
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account actions</CardTitle>
            <CardDescription>
              Suspend or reactivate the account, or generate a password-recovery link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UserActions
              userId={user.id}
              username={user.username}
              suspended={suspension.suspended}
              isSelf={isSelf}
            />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {user.recentActivity.length === 0 ? (
              <p className="py-4 text-center text-sm text-[var(--aidify-secondary)]">
                No activity recorded for this user.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--aidify-border)]">
                {user.recentActivity.map((a) => (
                  <li key={a.id} className="py-2.5">
                    <p className="text-sm font-medium text-[var(--aidify-text)]">
                      {a.action}
                      <span className="ml-1.5 font-normal text-[var(--aidify-secondary)]">
                        {a.resource_type}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--aidify-secondary)]">
                      {formatDateTime(a.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Security events</CardTitle>
          </CardHeader>
          <CardContent>
            {user.recentSecurityEvents.length === 0 ? (
              <p className="py-4 text-center text-sm text-[var(--aidify-secondary)]">
                No security events recorded for this user.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--aidify-border)]">
                {user.recentSecurityEvents.map((e) => (
                  <li key={e.id} className="py-2.5">
                    <p className="text-sm font-medium text-[var(--aidify-text)]">
                      {e.event_type}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--aidify-secondary)]">
                      {formatDateTime(e.created_at)}
                      {e.ip ? ` · ${e.ip}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
