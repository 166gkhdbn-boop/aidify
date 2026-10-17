import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { MonitorSmartphone } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listMySecurityEvents } from "@/lib/dal/profile";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  EmptyState,
  Badge,
} from "@/components/ui";
import { PageHeader } from "@/app/app/_components/page-header";
import { RoutePagination } from "@/app/app/_components/route-pagination";
import { timeAgo } from "@/app/app/_components/notification-bell";
import { ChangePasswordForm } from "./_components/change-password-form";
import { DeleteAccount } from "./_components/delete-account";

export const metadata: Metadata = { title: "Security" };

function clientIp(headerStore: Headers): string | null {
  const forwarded = headerStore.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return headerStore.get("x-real-ip")?.trim() || null;
}

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const user = await requireUser("/app/security");
  const headerStore = await headers();
  const ip = clientIp(headerStore);
  const userAgent = headerStore.get("user-agent");

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 20));
  const eventsRes = await listMySecurityEvents({ page, pageSize });
  if (!eventsRes.ok) notFound();
  const { items, total } = eventsRes.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security"
        description="Your current session, sign-in history and account controls."
      />

      {/* Current session */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MonitorSmartphone className="size-4 text-[var(--aidify-success)]" aria-hidden="true" />
            Current session
            <Badge variant="success" className="ml-1">Active</Badge>
          </CardTitle>
          <CardDescription>
            This is the session you are using right now.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--aidify-border)] bg-white/[0.02] p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-[var(--aidify-secondary)]">IP address</dt>
              <dd className="mt-1 font-mono text-sm text-[var(--aidify-text)]">{ip ?? "Not available"}</dd>
            </div>
            <div className="rounded-xl border border-[var(--aidify-border)] bg-white/[0.02] p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-[var(--aidify-secondary)]">Last sign-in</dt>
              <dd className="mt-1 text-sm text-[var(--aidify-text)]">
                {user.last_sign_in_at ? timeAgo(user.last_sign_in_at) : "Not available"}
              </dd>
            </div>
            <div className="rounded-xl border border-[var(--aidify-border)] bg-white/[0.02] p-3 sm:col-span-1">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-[var(--aidify-secondary)]">Device</dt>
              <dd className="mt-1 truncate text-sm text-[var(--aidify-text)]" title={userAgent ?? undefined}>
                {userAgent ?? "Not available"}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-[var(--aidify-secondary)]">
            Aidify only tracks the session you are using. Device and IP details are
            reported when your network provides them — otherwise they honestly show
            as not available.
          </p>
        </CardContent>
      </Card>

      {/* Security event history */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base">Security history</CardTitle>
          <CardDescription>Sign-ins, password changes and other security events on your account.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <EmptyState
              title="No security events"
              description="Events like sign-ins and password changes will appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Event</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium text-[var(--aidify-text)]">
                        {e.event_type.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell className="font-mono text-[var(--aidify-secondary)]">
                        {e.ip ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-[var(--aidify-secondary)]" title={new Date(e.created_at).toLocaleString()}>
                        {timeAgo(e.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      {total > 0 && (
        <Suspense>
          <RoutePagination page={page} pageSize={pageSize} total={total} />
        </Suspense>
      )}

      <ChangePasswordForm />
      <DeleteAccount email={user.email ?? null} />
    </div>
  );
}
