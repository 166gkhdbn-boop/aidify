"use client";

import * as React from "react";
import Link from "next/link";
import { Eye } from "lucide-react";
import { Avatar, Badge, Button, EmptyState, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import { DataTable, type DataTableColumn, type DataTableState } from "@/components/data-table";
import { listUsersAdminAction } from "@/actions/admin";
import type { AdminUserRow, RoleRow } from "@/app/admin/_lib/queries";
import type { PageResult } from "@/lib/dal/types";
import { formatDate } from "@/app/admin/_lib/format";

function RoleBadge({ role }: { role: string }) {
  const variant =
    role === "administrator" ? "error" : role === "moderator" ? "violet" : "muted";
  return <Badge variant={variant}>{role}</Badge>;
}

/**
 * Admin user directory: username/display-name search, role filter, suspended
 * filter — all applied server-side with server-side pagination.
 *
 * Honest limitation: emails live in the auth directory (not in profiles),
 * so they cannot be searched — they are shown per row.
 */
export function UsersTable({
  initial,
  roles,
}: {
  initial: PageResult<AdminUserRow>;
  roles: RoleRow[];
}) {
  const [state, setState] = React.useState<DataTableState>({
    page: initial.page,
    pageSize: initial.pageSize,
    search: undefined,
    filters: { role: "all", suspended: "all" },
  });
  const [rows, setRows] = React.useState(initial.items);
  const [total, setTotal] = React.useState(initial.total);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const requestId = React.useRef(0);

  const filters = (state.filters ?? {}) as { role?: string; suspended?: string };

  const fetchPage = React.useCallback(
    async (next: DataTableState) => {
      const id = ++requestId.current;
      setLoading(true);
      setError(null);
      const f = (next.filters ?? {}) as { role?: string; suspended?: string };
      const result = await listUsersAdminAction(
        {
          role: f.role && f.role !== "all" ? f.role : undefined,
          suspended: (f.suspended as "all" | "suspended" | "active" | undefined) ?? "all",
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
      void fetchPage(next);
    },
    [fetchPage],
  );

  const columns: DataTableColumn<AdminUserRow>[] = React.useMemo(
    () => [
      {
        key: "user",
        header: "User",
        cell: (row) => (
          <div className="flex items-center gap-3">
            <Avatar
              src={row.avatar_url}
              alt={row.username}
              fallback={(row.username.charAt(0) || "?").toUpperCase()}
              size="sm"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--aidify-text)]">
                {row.username}
              </p>
              {row.display_name && (
                <p className="truncate text-xs text-[var(--aidify-secondary)]">
                  {row.display_name}
                </p>
              )}
            </div>
          </div>
        ),
      },
      {
        key: "email",
        header: "Email",
        cell: (row) => (
          <span className="text-sm text-[var(--aidify-secondary)]">
            {row.email ?? <span className="opacity-60">—</span>}
          </span>
        ),
      },
      {
        key: "roles",
        header: "Roles",
        cell: (row) => (
          <div className="flex flex-wrap gap-1">
            {row.roles.length === 0 ? (
              <Badge variant="muted">user</Badge>
            ) : (
              row.roles.map((r) => <RoleBadge key={r} role={r} />)
            )}
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        cell: (row) =>
          row.suspended ? (
            <Badge variant="error">Suspended</Badge>
          ) : (
            <Badge variant="success">Active</Badge>
          ),
      },
      {
        key: "created_at",
        header: "Joined",
        cell: (row) => (
          <span className="whitespace-nowrap text-sm text-[var(--aidify-secondary)]">
            {formatDate(row.created_at)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable<AdminUserRow>
      columns={columns}
      rows={rows}
      total={total}
      state={state}
      onChange={handleChange}
      getRowId={(row) => row.id}
      loading={loading}
      error={error}
      onRetry={() => void fetchPage(state)}
      searchPlaceholder="Search by username or display name…"
      toolbar={
        <>
          <Select
            value={filters.role ?? "all"}
            onValueChange={(value) =>
              handleChange({ ...state, page: 1, filters: { ...filters, role: value } })
            }
            aria-label="Filter by role"
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.name}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.suspended ?? "all"}
            onValueChange={(value) =>
              handleChange({ ...state, page: 1, filters: { ...filters, suspended: value } })
            }
            aria-label="Filter by suspension status"
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Any status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </>
      }
      rowActions={(row) => (
        <Button variant="ghost" size="icon-sm" asChild aria-label={`View ${row.username}`}>
          <Link href={`/admin/users/${row.id}`}>
            <Eye aria-hidden="true" />
          </Link>
        </Button>
      )}
      emptyState={
        <EmptyState
          title="No users found"
          description="No users match the current search and filters."
        />
      }
    />
  );
}
