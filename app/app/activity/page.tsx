import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { listActivity } from "@/lib/dal/activity";
import {
  Card,
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

export const metadata: Metadata = { title: "Activity" };

function metadataSummary(metadata: Record<string, unknown>): string {
  const entries = Object.entries(metadata).filter(([, v]) => v !== null && v !== undefined);
  if (entries.length === 0) return "—";
  return entries
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 20));

  const res = await listActivity({ page, pageSize });
  if (!res.ok) notFound();
  const { items, total } = res.data;

  return (
    <div>
      <PageHeader
        title="Activity"
        description="Everything you've done in Aidify, newest first."
      />
      <Card className="glass-panel">
        <CardContent className="p-0">
          {items.length === 0 ? (
            <EmptyState
              title="No activity yet"
              description="Your actions — creating, editing, importing — will be recorded here."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium text-[var(--aidify-text)]">
                        {a.action.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="muted">{a.resource_type}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[320px] truncate text-[var(--aidify-secondary)]" title={metadataSummary(a.metadata)}>
                        {metadataSummary(a.metadata)}
                      </TableCell>
                      <TableCell className="text-right text-[var(--aidify-secondary)]" title={new Date(a.created_at).toLocaleString()}>
                        {timeAgo(a.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="mt-4">
        <Suspense>
          <RoutePagination page={page} pageSize={pageSize} total={total} />
        </Suspense>
      </div>
    </div>
  );
}
