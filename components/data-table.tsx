"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search, AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Pagination,
  Checkbox,
  Input,
  Skeleton,
  EmptyState,
  Button,
} from "@/components/ui";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface DataTableColumn<T> {
  /** Unique column id — also the sort key when sortable. */
  key: string;
  header: React.ReactNode;
  /** Defaults to String(row[key]). */
  cell?: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
}

export interface DataTableSort {
  key: string;
  direction: "asc" | "desc";
}

export interface DataTableState {
  page: number;
  pageSize: number;
  sort?: DataTableSort | null;
  search?: string;
  filters?: Record<string, unknown>;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  /** Total row count across all pages (server-provided). */
  total: number;
  state: DataTableState;
  /** Called on page/pageSize/sort/search change. Feature agents refetch here. */
  onChange: (next: DataTableState) => void;
  getRowId: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Row selection. */
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  /** Bulk action bar slot, rendered when ≥1 row is selected. */
  bulkActions?: (selectedIds: string[]) => React.ReactNode;
  /** Custom empty state (defaults to a generic one). */
  emptyState?: React.ReactNode;
  showSearch?: boolean;
  searchPlaceholder?: string;
  /** Extra toolbar content (filter controls owned by the feature). */
  toolbar?: React.ReactNode;
  /** Per-row actions cell. */
  rowActions?: (row: T) => React.ReactNode;
  className?: string;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function DataTable<T>({
  columns,
  rows,
  total,
  state,
  onChange,
  getRowId,
  loading = false,
  error = null,
  onRetry,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  bulkActions,
  emptyState,
  showSearch = true,
  searchPlaceholder = "Search…",
  toolbar,
  rowActions,
  className,
}: DataTableProps<T>) {
  const [searchInput, setSearchInput] = React.useState(state.search ?? "");
  const searchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the local input in sync when state.search changes externally
  // (React's "adjust state during render" pattern for prop changes).
  const [prevExternalSearch, setPrevExternalSearch] = React.useState(state.search ?? "");
  if (prevExternalSearch !== (state.search ?? "")) {
    setPrevExternalSearch(state.search ?? "");
    setSearchInput(state.search ?? "");
  }

  const emitSearch = React.useCallback(
    (value: string) => {
      onChange({ ...state, search: value || undefined, page: 1 });
    },
    [onChange, state],
  );

  const onSearchInput = (value: string) => {
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => emitSearch(value), 350);
  };

  React.useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );

  const toggleSort = (column: DataTableColumn<T>) => {
    if (!column.sortable) return;
    const current = state.sort;
    let next: DataTableSort | null;
    if (current?.key !== column.key) next = { key: column.key, direction: "asc" };
    else if (current.direction === "asc") next = { key: column.key, direction: "desc" };
    else next = null;
    onChange({ ...state, sort: next ?? undefined, page: 1 });
  };

  const pageIds = rows.map(getRowId);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const somePageSelected = pageIds.some((id) => selectedIds.includes(id));

  const toggleRow = (id: string) => {
    if (!onSelectionChange) return;
    onSelectionChange(
      selectedIds.includes(id)
        ? selectedIds.filter((s) => s !== id)
        : [...selectedIds, id],
    );
  };

  const toggleAllPage = () => {
    if (!onSelectionChange) return;
    if (allPageSelected) {
      onSelectionChange(selectedIds.filter((id) => !pageIds.includes(id)));
    } else {
      const merged = new Set([...selectedIds, ...pageIds]);
      onSelectionChange([...merged]);
    }
  };

  const selectionCount = selectedIds.length;
  const columnCount =
    columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0);

  const renderCell = (row: T, column: DataTableColumn<T>): React.ReactNode => {
    if (column.cell) return column.cell(row);
    const value = (row as Record<string, unknown>)[column.key];
    if (value === null || value === undefined) return <span className="text-[var(--aidify-secondary)]/60">—</span>;
    return String(value);
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Toolbar */}
      {(showSearch || toolbar) && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {showSearch && (
            <div className="relative w-full max-w-sm">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--aidify-secondary)]"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={searchInput}
                onChange={(e) => onSearchInput(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label="Search table"
                className="pl-9"
              />
            </div>
          )}
          {toolbar}
        </div>
      )}

      {/* Bulk action bar */}
      {selectable && selectionCount > 0 && bulkActions && (
        <div
          role="status"
          className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--aidify-blue)]/30 bg-[var(--aidify-blue)]/10 px-4 py-2.5"
        >
          <span className="text-sm font-medium text-[var(--aidify-text)]">
            {selectionCount} selected
          </span>
          <div className="flex flex-wrap items-center gap-2">{bulkActions(selectedIds)}</div>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => onSelectionChange?.([])}
          >
            Clear
          </Button>
        </div>
      )}

      <div className="glass-panel overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {selectable && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allPageSelected}
                    indeterminate={somePageSelected && !allPageSelected}
                    onCheckedChange={toggleAllPage}
                    aria-label={allPageSelected ? "Deselect all rows on this page" : "Select all rows on this page"}
                  />
                </TableHead>
              )}
              {columns.map((column) => {
                const sorted = state.sort?.key === column.key;
                const SortIcon = !sorted ? ArrowUpDown : state.sort?.direction === "asc" ? ArrowUp : ArrowDown;
                return (
                  <TableHead key={column.key} className={column.headerClassName} aria-sort={sorted ? (state.sort?.direction === "asc" ? "ascending" : "descending") : undefined}>
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column)}
                        className="inline-flex cursor-pointer items-center gap-1.5 uppercase tracking-wider hover:text-[var(--aidify-text)]"
                        aria-label={`Sort by ${typeof column.header === "string" ? column.header : column.key}${sorted ? ` (${state.sort?.direction === "asc" ? "ascending" : "descending"})` : ""}`}
                      >
                        {column.header}
                        <SortIcon className="size-3.5" aria-hidden="true" />
                      </button>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                );
              })}
              {rowActions && <TableHead className="w-16 text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: Math.min(state.pageSize, 8) }).map((_, i) => (
                <TableRow key={`skeleton-${i}`} className="hover:bg-transparent">
                  {Array.from({ length: columnCount }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full max-w-[160px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : error ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columnCount}>
                  <div className="flex flex-col items-center gap-3 px-6 py-12 text-center" role="alert">
                    <AlertTriangle className="size-8 text-[var(--aidify-error)]" aria-hidden="true" />
                    <div>
                      <p className="font-semibold text-[var(--aidify-text)]">Couldn&apos;t load data</p>
                      <p className="mt-1 text-sm text-[var(--aidify-secondary)]">{error}</p>
                    </div>
                    {onRetry && (
                      <Button variant="secondary" size="sm" onClick={onRetry}>
                        <RefreshCw aria-hidden="true" />
                        Try again
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columnCount}>
                  {emptyState ?? (
                    <EmptyState
                      title="No results"
                      description="Nothing matches your current search and filters."
                    />
                  )}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const id = getRowId(row);
                const selected = selectedIds.includes(id);
                return (
                  <TableRow key={id} data-state={selected ? "selected" : undefined}>
                    {selectable && (
                      <TableCell>
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => toggleRow(id)}
                          aria-label={`Select row ${id}`}
                        />
                      </TableCell>
                    )}
                    {columns.map((column) => (
                      <TableCell key={column.key} className={column.className}>
                        {renderCell(row, column)}
                      </TableCell>
                    ))}
                    {rowActions && (
                      <TableCell className="text-right">
                        {rowActions(row)}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination
        page={state.page}
        pageSize={state.pageSize}
        total={total}
        onPageChange={(page) => onChange({ ...state, page })}
        onPageSizeChange={(pageSize) => onChange({ ...state, pageSize, page: 1 })}
      />
    </div>
  );
}
