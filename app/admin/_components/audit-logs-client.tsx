"use client";

import * as React from "react";
import { Eye, Info } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { JsonView } from "@/components/json-view";
import { DataTable, type DataTableColumn, type DataTableState } from "@/components/data-table";
import { listAuditLogsAdminAction } from "@/actions/admin";
import type { AuditLogRow } from "@/app/admin/_lib/queries";
import type { PageResult } from "@/lib/dal/types";
import { formatDateTime, humanizeAction } from "@/app/admin/_lib/format";

interface AuditFilters {
  action: string;
  actor: string;
  from: string;
  to: string;
}

/**
 * Append-only audit log browser: action filter, actor search (id or username
 * fragment), date range, text search — server-side pagination throughout.
 * Audit logs cannot be modified or deleted (enforced by a DB trigger).
 */
export function AuditLogsClient({
  initial,
  actionTypes,
}: {
  initial: PageResult<AuditLogRow>;
  actionTypes: string[];
}) {
  const [state, setState] = React.useState<DataTableState>({
    page: initial.page,
    pageSize: initial.pageSize,
  });
  const [filters, setFilters] = React.useState<AuditFilters>({
    action: "all",
    actor: "",
    from: "",
    to: "",
  });
  const [rows, setRows] = React.useState(initial.items);
  const [total, setTotal] = React.useState(initial.total);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<AuditLogRow | null>(null);
  const requestId = React.useRef(0);

  const fetchPage = React.useCallback(
    async (next: DataTableState, nextFilters: AuditFilters) => {
      const id = ++requestId.current;
      setLoading(true);
      setError(null);
      const result = await listAuditLogsAdminAction(
        {
          action: nextFilters.action !== "all" ? nextFilters.action : undefined,
          actor: nextFilters.actor.trim() || undefined,
          from: nextFilters.from || undefined,
          to: nextFilters.to || undefined,
        },
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
    },
    [],
  );

  const handleChange = React.useCallback(
    (next: DataTableState) => {
      setState(next);
      void fetchPage(next, filters);
    },
    [fetchPage, filters],
  );

  const applyFilters = (next: AuditFilters) => {
    setFilters(next);
    const nextState = { ...state, page: 1 };
    setState(nextState);
    void fetchPage(nextState, next);
  };

  const columns: DataTableColumn<AuditLogRow>[] = React.useMemo(
    () => [
      {
        key: "created_at",
        header: "Time",
        cell: (row) => (
          <span className="whitespace-nowrap text-sm text-[var(--aidify-secondary)]">
            {formatDateTime(row.created_at)}
          </span>
        ),
      },
      {
        key: "action",
        header: "Action",
        cell: (row) => (
          <span className="font-medium text-[var(--aidify-text)]">
            {humanizeAction(row.action)}
          </span>
        ),
      },
      {
        key: "actor",
        header: "Actor",
        cell: (row) => (
          <span className="text-sm text-[var(--aidify-secondary)]">
            {row.actor_username ? `@${row.actor_username}` : row.actor_id ? `${row.actor_id.slice(0, 8)}…` : "system"}
          </span>
        ),
      },
      {
        key: "target",
        header: "Target",
        cell: (row) => (
          <span className="text-sm text-[var(--aidify-secondary)]">
            {row.target_type}
            {row.target_id ? ` · ${row.target_id.slice(0, 8)}…` : ""}
          </span>
        ),
      },
      {
        key: "reason",
        header: "Reason",
        cell: (row) => (
          <span className="block max-w-[220px] truncate text-sm text-[var(--aidify-secondary)]" title={row.reason ?? undefined}>
            {row.reason ?? "—"}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div>
      <Alert variant="info" title="Append-only" className="mb-4">
        <span className="flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Audit logs cannot be modified or deleted — a database trigger rejects
          UPDATE and DELETE on this table for every role.
        </span>
      </Alert>

      <DataTable<AuditLogRow>
        columns={columns}
        rows={rows}
        total={total}
        state={state}
        onChange={handleChange}
        getRowId={(row) => row.id}
        loading={loading}
        error={error}
        onRetry={() => void fetchPage(state, filters)}
        searchPlaceholder="Search actions and targets…"
        toolbar={
          <>
            <Select
              value={filters.action}
              onValueChange={(value) => applyFilters({ ...filters, action: value })}
              aria-label="Filter by action type"
            >
              <SelectTrigger className="w-52">
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {actionTypes.map((a) => (
                  <SelectItem key={a} value={a}>
                    {humanizeAction(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="search"
              value={filters.actor}
              onChange={(e) => applyFilters({ ...filters, actor: e.target.value })}
              placeholder="Actor id or username…"
              aria-label="Search by actor"
              className="w-48"
            />
            <div className="flex items-center gap-1.5">
              <Label htmlFor="audit-from" className="sr-only">From date</Label>
              <Input
                id="audit-from"
                type="date"
                value={filters.from}
                max={filters.to || undefined}
                onChange={(e) => applyFilters({ ...filters, from: e.target.value })}
                aria-label="From date"
              />
              <span className="text-xs text-[var(--aidify-secondary)]">→</span>
              <Label htmlFor="audit-to" className="sr-only">To date</Label>
              <Input
                id="audit-to"
                type="date"
                value={filters.to}
                min={filters.from || undefined}
                onChange={(e) => applyFilters({ ...filters, to: e.target.value })}
                aria-label="To date"
              />
            </div>
          </>
        }
        rowActions={(row) => (
          <Button variant="ghost" size="icon-sm" onClick={() => setDetail(row)} aria-label="View audit entry details">
            <Eye aria-hidden="true" />
          </Button>
        )}
      />

      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detail ? humanizeAction(detail.action) : ""}</DialogTitle>
            <DialogDescription>
              {detail ? `${formatDateTime(detail.created_at)} · actor ${detail.actor_username ? `@${detail.actor_username}` : detail.actor_id ?? "system"}` : ""}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="muted">{detail.target_type}</Badge>
                {detail.target_id && <Badge variant="muted">{detail.target_id}</Badge>}
              </div>
              {detail.reason && (
                <p className="text-sm text-[var(--aidify-secondary)]">
                  <span className="font-medium text-[var(--aidify-text)]">Reason: </span>
                  {detail.reason}
                </p>
              )}
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--aidify-secondary)]">
                  Metadata
                </p>
                <JsonView data={detail.metadata} maxHeight="300px" />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
