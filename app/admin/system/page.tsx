import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  Database,
  Info,
  KeyRound,
  Mail,
  XCircle,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SetupRequired } from "@/components/setup-required";
import {
  Alert,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { getSystemHealthAction } from "@/actions/admin";
import { PageHeader } from "../_components/page-header";
import { StatCard } from "../_components/stat-card";
import { SystemRefreshButton } from "../_components/system-refresh-button";
import { formatDateTime } from "../_lib/format";

function HealthCard({
  title,
  ok,
  message,
}: {
  title: string;
  ok: boolean;
  message: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-5">
        <div
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl border ${
            ok
              ? "border-[var(--aidify-success)]/30 bg-[var(--aidify-success)]/15"
              : "border-[var(--aidify-error)]/30 bg-[var(--aidify-error)]/15"
          }`}
        >
          {ok ? (
            <CheckCircle2 className="size-5 text-[var(--aidify-success)]" aria-hidden="true" />
          ) : (
            <XCircle className="size-5 text-[var(--aidify-error)]" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--aidify-text)]">
            {title}
            <Badge variant={ok ? "success" : "error"}>{ok ? "Healthy" : "Failing"}</Badge>
          </p>
          <p className="mt-1.5 break-words text-xs leading-relaxed text-[var(--aidify-secondary)]">
            {message}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function AdminSystemPage() {
  if (!isSupabaseConfigured()) {
    return <SetupRequired feature="view system health" backHref="/admin" />;
  }
  await requireRole("administrator");

  const healthRes = await getSystemHealthAction();
  const supabaseConfigured = isSupabaseConfigured();

  return (
    <div>
      <PageHeader
        title="System"
        description="Live health probes, integration status, recent application errors, and operational warnings."
        actions={<SystemRefreshButton />}
      />

      {!healthRes.ok ? (
        <Alert variant="error" title="Could not run health checks">
          {healthRes.error.message}
        </Alert>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <HealthCard title="Database" ok={healthRes.data.database.ok} message={healthRes.data.database.message} />
            <HealthCard title="Auth service" ok={healthRes.data.auth.ok} message={healthRes.data.auth.message} />
          </div>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Integrations</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-[var(--aidify-border)]">
                <li className="flex items-center gap-3 py-3">
                  <Database className="size-4 shrink-0 text-[var(--aidify-secondary)]" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[var(--aidify-text)]">Supabase project</p>
                    <p className="text-xs text-[var(--aidify-secondary)]">
                      {supabaseConfigured
                        ? "Environment keys are set; probes above ran against the live project."
                        : "Environment keys are missing."}
                    </p>
                  </div>
                  <Badge variant={supabaseConfigured ? "success" : "error"}>
                    {supabaseConfigured ? "Configured" : "Not configured"}
                  </Badge>
                </li>
                <li className="flex items-center gap-3 py-3">
                  <Mail className="size-4 shrink-0 text-[var(--aidify-secondary)]" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[var(--aidify-text)]">Email provider</p>
                    <p className="text-xs text-[var(--aidify-secondary)]">
                      No transactional email provider is wired up — recovery links are
                      generated for manual delivery instead of being emailed.
                    </p>
                  </div>
                  <Badge variant="muted">Not configured</Badge>
                </li>
                <li className="flex items-center gap-3 py-3">
                  <KeyRound className="size-4 shrink-0 text-[var(--aidify-secondary)]" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[var(--aidify-text)]">Service-role key</p>
                    <p className="text-xs text-[var(--aidify-secondary)]">
                      Required for admin operations; never exposed to the browser.
                    </p>
                  </div>
                  <Badge variant={supabaseConfigured ? "success" : "error"}>
                    {supabaseConfigured ? "Present" : "Missing"}
                  </Badge>
                </li>
              </ul>
            </CardContent>
          </Card>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent application errors</CardTitle>
              </CardHeader>
              <CardContent>
                {healthRes.data.recentErrors.length === 0 ? (
                  <EmptyState
                    title="No errors recorded"
                    description="The app_errors table is empty — nothing has been reported."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Message</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {healthRes.data.recentErrors.map((e) => (
                          <TableRow key={e.id}>
                            <TableCell className="whitespace-nowrap text-[var(--aidify-secondary)]">
                              {formatDateTime(e.created_at)}
                            </TableCell>
                            <TableCell className="max-w-[320px] break-words text-sm text-[var(--aidify-text)]">
                              {e.message}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Operational warnings</CardTitle>
              </CardHeader>
              <CardContent>
                {healthRes.data.warnings.length === 0 ? (
                  <div className="flex items-center gap-2.5 py-4 text-sm text-[var(--aidify-secondary)]">
                    <CheckCircle2 className="size-5 text-[var(--aidify-success)]" aria-hidden="true" />
                    No operational warnings.
                  </div>
                ) : (
                  <ul className="space-y-2.5">
                    {healthRes.data.warnings.map((w, i) => (
                      <li key={i}>
                        <Alert variant={w.level === "warning" ? "warning" : "info"}>
                          <span className="flex items-start gap-2">
                            {w.level === "warning" ? (
                              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                            ) : (
                              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                            )}
                            {w.message}
                          </span>
                        </Alert>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Setup state"
          value={supabaseConfigured ? "Configured" : "Not configured"}
          icon={supabaseConfigured ? CheckCircle2 : CloudOff}
          tone={supabaseConfigured ? "success" : "error"}
          subtitle="Supabase environment keys present at startup"
        />
        <StatCard
          label="Error table"
          value={healthRes.ok ? healthRes.data.recentErrors.length : "—"}
          icon={AlertTriangle}
          subtitle="app_errors rows shown above (latest 20)"
        />
      </div>
    </div>
  );
}
