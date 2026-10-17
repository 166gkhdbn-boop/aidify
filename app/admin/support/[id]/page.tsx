import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SetupRequired } from "@/components/setup-required";
import { Alert, Badge } from "@/components/ui";
import { getTicketDetailAction } from "@/actions/admin";
import type { TicketPriority, TicketStatus } from "@/lib/dal/types";
import { PageHeader } from "../../_components/page-header";
import { TicketDetailClient } from "../../_components/ticket-detail-client";

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const variant =
    priority === "urgent" ? "error" : priority === "high" ? "warning" : priority === "medium" ? "info" : "muted";
  return <Badge variant={variant}>{priority}</Badge>;
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const variant =
    status === "open" ? "error" : status === "in_progress" ? "warning" : status === "resolved" ? "success" : "muted";
  return <Badge variant={variant}>{status === "in_progress" ? "in progress" : status}</Badge>;
}

export default async function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured()) {
    return <SetupRequired feature="view support tickets" backHref="/admin/support" />;
  }
  await requireRole("moderator");
  const { id } = await params;

  const result = await getTicketDetailAction(id);
  if (!result.ok) {
    if (result.error.code === "NOT_FOUND" || result.error.code === "VALIDATION") {
      notFound();
    }
    return (
      <div>
        <PageHeader title="Ticket" />
        <Alert variant="error" title="Could not load ticket">
          {result.error.message}
        </Alert>
      </div>
    );
  }
  const detail = result.data;

  return (
    <div>
      <Link
        href="/admin/support"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--aidify-secondary)] transition-colors hover:text-[var(--aidify-text)]"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to queue
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--aidify-text)]">
          {detail.ticket.subject}
        </h1>
        <StatusBadge status={detail.ticket.status} />
        <PriorityBadge priority={detail.ticket.priority} />
      </div>
      <TicketDetailClient detail={detail} />
    </div>
  );
}
