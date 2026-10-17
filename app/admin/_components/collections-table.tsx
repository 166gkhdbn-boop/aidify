"use client";

import * as React from "react";
import Link from "next/link";
import { Eye } from "lucide-react";
import { Badge, Button, EmptyState } from "@/components/ui";
import { DataTable, type DataTableColumn, type DataTableState } from "@/components/data-table";
import { listCollectionsAdminAction } from "@/actions/admin";
import type { AdminCollectionRow } from "@/app/admin/_lib/queries";
import type { PageResult } from "@/lib/dal/types";
import { formatDate } from "@/app/admin/_lib/format";

/** Platform-wide collection browser (read-only; no destructive actions). */
export function CollectionsTable({
  initial,
}: {
  initial: PageResult<AdminCollectionRow>;
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
    const result = await listCollectionsAdminAction({
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

  const columns: DataTableColumn<AdminCollectionRow>[] = React.useMemo(
    () => [
      {
        key: "name",
        header: "Collection",
        cell: (row) => (
          <div className="flex items-center gap-2.5">
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: row.color ?? "var(--aidify-blue)" }}
              aria-hidden="true"
            />
            <span className="font-medium text-[var(--aidify-text)]">{row.name}</span>
          </div>
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
        key: "config_count",
        header: "Configs",
        cell: (row) => (
          <span className="font-mono text-sm text-[var(--aidify-secondary)]">
            {row.config_count}
          </span>
        ),
      },
      {
        key: "archived_at",
        header: "State",
        cell: (row) =>
          row.archived_at ? (
            <Badge variant="muted">Archived</Badge>
          ) : (
            <Badge variant="success">Active</Badge>
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
    <DataTable<AdminCollectionRow>
      columns={columns}
      rows={rows}
      total={total}
      state={state}
      onChange={handleChange}
      getRowId={(row) => row.id}
      loading={loading}
      error={error}
      onRetry={() => void fetchPage(state)}
      searchPlaceholder="Search collections by name…"
      rowActions={(row) => (
        <Button variant="ghost" size="icon-sm" asChild aria-label={`View ${row.name}`}>
          <Link href={`/admin/collections/${row.id}`}>
            <Eye aria-hidden="true" />
          </Link>
        </Button>
      )}
      emptyState={
        <EmptyState
          title="No collections found"
          description="No collections match the current search."
        />
      }
    />
  );
}
