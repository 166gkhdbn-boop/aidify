"use client";

import * as React from "react";
import Link from "next/link";
import { Eye } from "lucide-react";
import { Badge, Button, EmptyState } from "@/components/ui";
import { DataTable, type DataTableColumn, type DataTableState } from "@/components/data-table";
import { moderateConfigsAction } from "@/actions/admin";
import type { ModeratedConfig } from "@/lib/dal/admin";
import type { PageResult } from "@/lib/dal/types";
import { formatDate } from "@/app/admin/_lib/format";

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "active" ? "success" : status === "archived" ? "muted" : "info";
  return <Badge variant={variant}>{status}</Badge>;
}

/**
 * Platform-wide configuration search for moderation. Searching is by
 * configuration name; moderation actions live on the detail page.
 */
export function ConfigsTable({
  initial,
}: {
  initial: PageResult<ModeratedConfig>;
}) {
  const [state, setState] = React.useState<DataTableState>({
    page: initial.page,
    pageSize: initial.pageSize,
  });
  const [rows, setRows] = React.useState(initial.items);
  const [total, setTotal] = React.useState(initial.total);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const requestId = React.useRef(0);

  const fetchPage = React.useCallback(async (next: DataTableState) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    const result = await moderateConfigsAction({
      page: next.page,
      pageSize: next.pageSize,
      search: next.search,
    });
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

  const columns: DataTableColumn<ModeratedConfig>[] = React.useMemo(
    () => [
      {
        key: "name",
        header: "Configuration",
        cell: (row) => (
          <span className="font-medium text-[var(--aidify-text)]">{row.name}</span>
        ),
      },
      {
        key: "owner",
        header: "Owner",
        cell: (row) => (
          <span className="text-sm text-[var(--aidify-secondary)]">
            {row.owner_username ? `@${row.owner_username}` : row.owner_id.slice(0, 8) + "…"}
          </span>
        ),
      },
      {
        key: "config_type",
        header: "Type",
        cell: (row) => (
          <span className="text-sm text-[var(--aidify-secondary)]">{row.config_type}</span>
        ),
      },
      {
        key: "environment",
        header: "Environment",
        cell: (row) => (
          <span className="text-sm text-[var(--aidify-secondary)]">{row.environment}</span>
        ),
      },
      {
        key: "status",
        header: "Status",
        cell: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: "version",
        header: "v",
        cell: (row) => (
          <span className="font-mono text-sm text-[var(--aidify-secondary)]">
            {row.version}
          </span>
        ),
      },
      {
        key: "updated_at",
        header: "Updated",
        cell: (row) => (
          <span className="whitespace-nowrap text-sm text-[var(--aidify-secondary)]">
            {formatDate(row.updated_at)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable<ModeratedConfig>
      columns={columns}
      rows={rows}
      total={total}
      state={state}
      onChange={handleChange}
      getRowId={(row) => row.id}
      loading={loading}
      error={error}
      onRetry={() => void fetchPage(state)}
      searchPlaceholder="Search configurations by name…"
      rowActions={(row) => (
        <Button variant="ghost" size="icon-sm" asChild aria-label={`Inspect ${row.name}`}>
          <Link href={`/admin/configs/${row.id}`}>
            <Eye aria-hidden="true" />
          </Link>
        </Button>
      )}
      emptyState={
        <EmptyState
          title="No configurations found"
          description="No configurations match the current search."
        />
      }
    />
  );
}
