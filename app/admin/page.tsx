import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileJson,
  HardDrive,
  Info,
  LifeBuoy,
  ShieldAlert,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SetupRequired } from "@/components/setup-required";
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import {
  getPlatformOverviewAction,
  getPendingTicketsCountAction,
  getRecentAdminActionsAction,
  getSystemHealthAction,
} from "@/actions/admin";
import { PageHeader } from "./_components/page-header";
import { StatCard } from "./_components/stat-card";
import { TrendChartLazy, ChartCardLazy } from "./_components/admin-charts-lazy";
import { humanizeAction, timeAgo } from "./_lib/format";

export default async function AdminOverviewPage() {
  if (!isSupabaseConfigured()) {
    return <SetupRequired feature="view the admin overview" backHref="/" />;
  }
  await requireRole("administrator");

  const [overviewRes, pendingRes, actionsRes, healthRes] = await Promise.all([
    getPlatformOverviewAction(),
    getPendingTicketsCountAction(),
    getRecentAdminActionsAction(),
    getSystemHealthAction(),
  ]);

  if (!overviewRes.ok) {
    return (
      <div>
        <PageHeader title="Overview" description="Platform health at a glance." />
        <Alert variant="error" title="Could not load platform metrics">
          {overviewRes.error.message}
        </Alert>
      </div>
    );
  }

  const overview = overviewRes.data;
  const newUsers30d = overview.newUsersPerDay.reduce((sum, d) => sum + d.count, 0);
  const failedToday = overview.failedLogins.perDay.at(-1)?.count ?? 0;
  const pendingTickets = pendingRes.ok ? pendingRes.data.open : null;
  const recentActions = actionsRes.ok ? actionsRes.data : [];
  const warnings = healthRes.ok ? healthRes.data.warnings : [];

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Platform health at a glance. Every metric below comes from a live database query."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total users" value={overview.totalUsers.toLocaleString()} icon={Users} subtitle="Registered profiles" />
        <StatCard label="New users (30d)" value={newUsers30d.toLocaleString()} icon={UserPlus} subtitle="Signups in the last 30 days" />
        <StatCard
          label="Active accounts"
          value={overview.activeAccounts.toLocaleString()}
          icon={UserCheck}
          tone="success"
          subtitle="Rule: any activity_logs or security_events entry in the last 30 days"
        />
        <StatCard label="Total configurations" value={overview.totalConfigs.toLocaleString()} icon={FileJson} subtitle="Across all users and statuses" />
        <StatCard
          label="Failed logins (today)"
          value={failedToday.toLocaleString()}
          icon={ShieldAlert}
          tone={failedToday > 0 ? "warning" : "default"}
          subtitle="Login failures in the current UTC day (security_events)"
        />
        <StatCard
          label="Open support tickets"
          value={pendingTickets === null ? "—" : pendingTickets.toLocaleString()}
          icon={LifeBuoy}
          subtitle={pendingTickets === null ? "Could not load ticket queue" : "Awaiting staff triage"}
        />
        <StatCard
          label="Storage used"
          value={null}
          icon={HardDrive}
          subtitle="Not available — Aidify has no files table, so storage cannot be measured"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ChartCardLazy title="New users per day" description="Signups over the last 30 days">
          <TrendChartLazy data={overview.newUsersPerDay} id="overview-users" color="var(--aidify-blue)" />
        </ChartCardLazy>
        <ChartCardLazy title="Configurations created per day" description="New configurations over the last 30 days">
          <TrendChartLazy data={overview.configsPerDay} id="overview-configs" color="var(--aidify-cyan)" />
        </ChartCardLazy>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent admin actions</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActions.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--aidify-secondary)]">
                No admin actions recorded yet.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--aidify-border)]">
                {recentActions.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 py-2.5">
                    <Database className="mt-0.5 size-4 shrink-0 text-[var(--aidify-secondary)]" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--aidify-text)]">
                        {humanizeAction(a.action)}
                        <span className="ml-1.5 font-normal text-[var(--aidify-secondary)]">
                          {a.target_type}
                          {a.target_id ? ` · ${a.target_id.slice(0, 8)}…` : ""}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--aidify-secondary)]">
                        {a.actor_username ?? "system"} · {timeAgo(a.created_at)}
                        {a.reason ? ` · ${a.reason}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Operational warnings</CardTitle>
          </CardHeader>
          <CardContent>
            {warnings.length === 0 ? (
              <div className="flex items-center gap-2.5 py-6 text-sm text-[var(--aidify-secondary)]">
                <CheckCircle2 className="size-5 text-[var(--aidify-success)]" aria-hidden="true" />
                All clear — no operational warnings right now.
              </div>
            ) : (
              <ul className="space-y-2.5">
                {warnings.map((w, i) => (
                  <li key={i}>
                    <Alert
                      variant={w.level === "warning" ? "warning" : "info"}
                      title={w.level === "warning" ? "Warning" : "Notice"}
                    >
                      <span className="flex items-center gap-2">
                        {w.level === "warning" ? (
                          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                        ) : (
                          <Info className="size-4 shrink-0" aria-hidden="true" />
                        )}
                        {w.message}
                      </span>
                    </Alert>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant={overview.failedLogins.total > 0 ? "warning" : "success"}>
                {overview.failedLogins.total.toLocaleString()} failed logins (30d)
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
