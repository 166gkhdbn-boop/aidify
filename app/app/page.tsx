import type { Metadata } from "next";
import Link from "next/link";
import {
  FileJson2,
  FolderKanban,
  Layers,
  Plus,
  Upload,
  Megaphone,
  ArrowRight,
  FilePlus2,
  FolderPlus,
} from "lucide-react";
import { notFound } from "next/navigation";
import { getDashboardStats, getPublishedAnnouncements } from "@/lib/dal/dashboard";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  EmptyState,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
} from "@/components/ui";
import { PageHeader } from "./_components/page-header";
import { RefreshButton } from "./_components/refresh-button";
import { DashboardChartsLazy } from "./_components/dashboard-charts-lazy";
import { timeAgo } from "./_components/notification-bell";

export const metadata: Metadata = { title: "Dashboard" };

const STATUS_VARIANT: Record<string, "success" | "muted" | "warning"> = {
  active: "success",
  archived: "muted",
  draft: "warning",
};

function humanizeAction(action: string): string {
  return action
    .replace(/^config_/, "Configuration ")
    .replace(/^collection_/, "Collection ")
    .replace(/^configs_/, "Configurations ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function DashboardPage() {
  const [statsRes, announcementsRes] = await Promise.all([
    getDashboardStats(),
    getPublishedAnnouncements(),
  ]);
  if (!statsRes.ok) notFound();
  const stats = statsRes.data;
  const announcements = announcementsRes.ok ? announcementsRes.data : [];

  const cards = [
    {
      label: "Total configurations",
      value: stats.totals.total,
      href: "/app/configs",
      icon: FileJson2,
      accent: "text-[var(--aidify-blue)]",
    },
    {
      label: "Active",
      value: stats.totals.active,
      href: "/app/configs?status=active",
      icon: FileJson2,
      accent: "text-[var(--aidify-success)]",
    },
    {
      label: "Draft",
      value: stats.totals.draft,
      href: "/app/configs?status=draft",
      icon: FileJson2,
      accent: "text-[var(--aidify-warning)]",
    },
    {
      label: "Archived",
      value: stats.totals.archived,
      href: "/app/configs?status=archived",
      icon: FileJson2,
      accent: "text-[var(--aidify-secondary)]",
    },
    {
      label: "Collections",
      value: stats.collections,
      href: "/app/collections",
      icon: FolderKanban,
      accent: "text-[var(--aidify-violet)]",
    },
    {
      label: "Projects",
      value: stats.projects,
      href: null,
      icon: Layers,
      accent: "text-[var(--aidify-cyan)]",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Your configurations at a glance — live from your data."
        actions={<RefreshButton />}
      />

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => {
          const inner = (
            <>
              <card.icon className={`size-5 ${card.accent}`} aria-hidden="true" />
              <p className="mt-3 text-3xl font-bold tracking-tight text-[var(--aidify-text)]">
                {card.value}
              </p>
              <p className="mt-1 text-xs font-medium text-[var(--aidify-secondary)]">
                {card.label}
              </p>
            </>
          );
          const cls =
            "glass-panel-hover rounded-2xl p-4 transition-transform hover:-translate-y-0.5";
          return card.href ? (
            <Link key={card.label} href={card.href} className={cls} aria-label={`View ${card.label}`}>
              {inner}
            </Link>
          ) : (
            <div key={card.label} className={cls} title="Projects are assigned when creating or editing a configuration">
              {inner}
            </div>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/app/configs/new">
            <Plus aria-hidden="true" />
            New configuration
          </Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/app/collections?new=1">
            <FolderPlus aria-hidden="true" />
            New collection
          </Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/app/configs?import=1">
            <Upload aria-hidden="true" />
            Import
          </Link>
        </Button>
      </div>

      {/* Charts */}
      <div className="mb-6">
        <DashboardChartsLazy
          createdPerDay={stats.createdPerDay}
          activityPerDay={stats.activityPerDay}
          byStatus={stats.byStatus}
          byType={stats.byType}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recently modified */}
        <Card className="glass-panel lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recently modified</CardTitle>
            <Button variant="link" size="sm" asChild>
              <Link href="/app/configs">
                View all
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {stats.recentConfigs.length === 0 ? (
              <EmptyState
                icon={FilePlus2}
                title="No configurations yet"
                description="Use the quick actions above to create your first configuration."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Env</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.recentConfigs.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Link
                            href={`/app/configs/${c.id}`}
                            className="font-medium text-[var(--aidify-text)] hover:text-[var(--aidify-cyan)] hover:underline"
                          >
                            {c.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-[var(--aidify-secondary)]">
                          {c.config_type}
                        </TableCell>
                        <TableCell className="text-[var(--aidify-secondary)]">
                          {c.environment}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[c.status] ?? "muted"}>
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-[var(--aidify-secondary)]">
                          {timeAgo(c.updated_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent activity</CardTitle>
            <Button variant="link" size="sm" asChild>
              <Link href="/app/activity">
                View all
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {stats.recentActivity.length === 0 ? (
              <EmptyState
                title="No activity yet"
                description="Your actions will be recorded here."
              />
            ) : (
              <ul className="space-y-3">
                {stats.recentActivity.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 text-sm">
                    <span
                      className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--aidify-blue)]"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[var(--aidify-text)]">
                        {humanizeAction(a.action)}
                      </p>
                      <p className="text-xs text-[var(--aidify-secondary)]">
                        {a.resource_type} · {timeAgo(a.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Announcements */}
      {announcements.length > 0 && (
        <Card className="glass-panel mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="size-4 text-[var(--aidify-warning)]" aria-hidden="true" />
              Announcements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {announcements.map((a) => (
              <article key={a.id} className="rounded-xl border border-[var(--aidify-border)] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-[var(--aidify-text)]">{a.title}</h3>
                  <span className="shrink-0 text-xs text-[var(--aidify-secondary)]">
                    {timeAgo(a.created_at)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--aidify-secondary)]">
                  {a.body}
                </p>
              </article>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
