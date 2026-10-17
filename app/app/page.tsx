import type { Metadata } from "next";
import Link from "next/link";
import {
  Users,
  UserCheck,
  HardDrive,
  CalendarClock,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { notFound } from "next/navigation";
import { getProxyStats, listProxyUsers, formatBytes } from "@/lib/dal/proxy-users";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
  EmptyState,
} from "@/components/ui";
import { PageHeader } from "./_components/page-header";
import { RefreshButton } from "./_components/refresh-button";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [statsRes, usersRes] = await Promise.all([
    getProxyStats(),
    listProxyUsers(),
  ]);
  if (!statsRes.ok || !usersRes.ok) notFound();
  const stats = statsRes.data;
  const users = usersRes.data;

  const cards = [
    {
      label: "Total users",
      value: String(stats.total),
      icon: Users,
      hint: `${stats.active} active right now`,
    },
    {
      label: "Active",
      value: String(stats.active),
      icon: UserCheck,
      hint:
        stats.disabled > 0
          ? `${stats.disabled} disabled`
          : "Everyone else is fine",
    },
    {
      label: "Data served",
      value: formatBytes(stats.totalUsageBytes),
      icon: HardDrive,
      hint: "Up + down across all users",
    },
    {
      label: "Expiring soon",
      value: String(stats.expiringSoon),
      icon: CalendarClock,
      hint: "Within the next 7 days",
    },
  ];

  const attention = users.filter((u) => {
    const s =
      !u.enabled
        ? "disabled"
        : u.expires_at && new Date(u.expires_at).getTime() < Date.now()
          ? "expired"
          : u.data_limit != null &&
              Number(u.total_up || 0) + Number(u.total_down || 0) >=
                Number(u.data_limit)
            ? "quota_exceeded"
            : "active";
    return s === "expired" || s === "quota_exceeded";
  });

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Proxy users at a glance — usage, limits and expiries."
        actions={<RefreshButton />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[var(--aidify-secondary)]">
                {c.label}
              </CardTitle>
              <c.icon className="size-4 text-[var(--aidify-secondary)]" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{c.value}</div>
              <p className="mt-1 text-xs text-[var(--aidify-secondary)]">
                {c.hint}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {attention.length > 0 && (
        <Card className="mt-6 border-[var(--aidify-warning)]/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[var(--aidify-warning)]">
              <AlertTriangle className="size-4" />
              Needs attention ({attention.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {attention.map((u) => (
              <Link key={u.id} href={`/app/users/${u.id}`}>
                <Badge variant="warning" className="cursor-pointer">
                  {u.name}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Users</CardTitle>
          <Link href="/app/users">
            <Button variant="ghost" size="sm">
              Manage all <ArrowRight className="size-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <EmptyState
              title="No users yet"
              description="Create your first proxy user from the Users page."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {users.slice(0, 5).map((u) => (
                <Link
                  key={u.id}
                  href={`/app/users/${u.id}`}
                  className="flex items-center justify-between rounded-lg border border-[var(--aidify-border)] bg-white/[0.02] px-4 py-3 transition hover:bg-white/[0.05]"
                >
                  <span className="font-medium">{u.name}</span>
                  <span className="text-sm text-[var(--aidify-secondary)]">
                    {formatBytes(
                      Number(u.total_up || 0) + Number(u.total_down || 0),
                    )}
                    {u.data_limit != null &&
                      ` / ${formatBytes(Number(u.data_limit))}`}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
