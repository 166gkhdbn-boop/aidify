"use client";

import * as React from "react";
import Link from "next/link";
import { Eye } from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { DataTable, type DataTableColumn, type DataTableState } from "@/components/data-table";
import { listSupportTicketsAction } from "@/actions/admin";
import type { AdminTicketSummary } from "@/lib/dal/admin";
import type { PageResult, TicketPriority, TicketStatus } from "@/lib/dal/types";
import { formatDate, timeAgo } from "@/app/admin/_lib/format";

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const variant =
    priority === "urgent" ? "error" : priority === "high" ? "warning" : priority === "medium" ? "info" : "muted";
  return <Badge variant={variant}>{priority}</Badge>;
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const variant =
    status === "open" ? "error" : status === "in_progress" ? "warning" : status === "resolved" ? "success" : "muted";
  const label = status === "in_progress" ? "in progress" : status;
  return <Badge variant={variant}>{label}</Badge>;
}

const STATUSES: ("all" | TicketStatus)[] = ["all", "open", "in_progress", "resolved", "closed"];

/**
 * Staff support queue. Status and priority filters are server-side; the
 * reply thread and status transitions live on the ticket detail page.
 */
export function SupportQueueClient({
  initial,
  supportEmail,
}: {
  initial: PageResult<AdminTicketSummary>;
  supportEmail: string | null;
}) {
  const [state, setState] = React.useState<DataTableState>({
    page: initial.page,
    pageSize: initial.pageSize,
    filters: { status: "all" },
  });
  const [rows, setRows] = React.useState(initial.items);
  const [total, setTotal] = React.useState(initial.total);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const requestId = React.useRef(0);

  const status = ((state.filters ?? {}) as { status?: string }).status ?? "all";

  const fetchPage = React.useCallback(async (next: DataTableState) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    const f = (next.filters ?? {}) as { status?: string };
    const result = await listSupportTicketsAction(
      f.status && f.status !== "all" ? (f.status as TicketStatus) : null,
      { page: next.page, pageSize: next.pageSize, search: next.search },
    );
    if (id !== requestId.current) return;
    setLoading(false);
    if (result.ok) {
      setRows(result.data.items);
      setTotal(result.data.total);
    } else {
      setError(result.error.message);
    }
  }, []);

  const handleChange = React.useCallback(
    (next: DataTableState) => {
      setState(next);
      void fetchPage(next);
    },
    [fetchPage],
  );

  const columns: DataTableColumn<AdminTicketSummary>[] = React.useMemo(
    () => [
      {
        key: "subject",
        header: "Subject",
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-[var(--aidify-text)]">{row.subject}</p>
            <p className="truncate text-xs text-[var(--aidify-secondary)]">
              {row.username ? `@${row.username}` : "unknown user"} · {row.reply_count} repl{row.reply_count === 1 ? "y" : "ies"}
            </p>
          </div>
        ),
      },
      {
        key: "priority",
        header: "Priority",
        cell: (row) => <PriorityBadge priority={row.priority} />,
      },
      {
        key: "status",
        header: "Status",
        cell: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: "updated_at",
        header: "Updated",
        cell: (row) => (
          <span className="whitespace-nowrap text-sm text-[var(--aidify-secondary)]" title={formatDate(row.updated_at)}>
            {timeAgo(row.updated_at)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div>
      {supportEmail && (
        <p className="mb-4 text-sm text-[var(--aidify-secondary)]">
          Public support contact: <span className="font-medium text-[var(--aidify-text)]">{supportEmail}</span>
          {" "}(configured in Settings)
        </p>
      )}
      <DataTable<AdminTicketSummary>
        columns={columns}
        rows={rows}
        total={total}
        state={state}
        onChange={handleChange}
        getRowId={(row) => row.id}
        loading={loading}
        error={error}
        onRetry={() => void fetchPage(state)}
        searchPlaceholder="Search subjects and descriptions…"
        toolbar={
          <Select
            value={status}
            onValueChange={(value) =>
              handleChange({ ...state, page: 1, filters: { ...state.filters, status: value } })
            }
            aria-label="Filter by ticket status"
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "all" ? "All statuses" : s === "in_progress" ? "In progress" : s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        rowActions={(row) => (
          <Button variant="ghost" size="icon-sm" asChild aria-label={`Open ticket ${row.subject}`}>
            <Link href={`/admin/support/${row.id}`}>
              <Eye aria-hidden="true" />
            </Link>
          </Button>
        )}
        emptyState={
          <EmptyState
            title="No tickets"
            description="The queue is clear for this filter — nothing to triage."
          />
        }
      />
    </div>
  );
}
