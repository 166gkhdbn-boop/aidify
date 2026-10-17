"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Upload,
  MoreHorizontal,
  Eye,
  Pencil,
  Copy,
  Archive,
  ArchiveRestore,
  Trash2,
  Download,
  X,
} from "lucide-react";
import {
  DataTable,
  type DataTableState,
  type DataTableColumn,
} from "@/components/data-table";
import {
  Button,
  Badge,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  EmptyState,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import {
  listConfigsAction,
  archiveConfigAction,
  restoreConfigAction,
  deleteConfigAction,
  duplicateConfigAction,
  bulkArchiveAction,
  bulkDeleteAction,
  bulkExportAction,
} from "@/actions/configs";
import { listCollectionsAction } from "@/actions/collections";
import { listTagsAction } from "@/actions/tags";
import type { ConfigSummary } from "@/lib/dal/types";
import { ConfirmDialog } from "@/app/app/_components/confirm-dialog";
import { ImportDialog } from "./import-dialog";
import { downloadExport } from "./export-utils";

const STATUS_VARIANT: Record<string, "success" | "muted" | "warning"> = {
  active: "success",
  archived: "muted",
  draft: "warning",
};

const TYPES = [
  "application",
  "api-endpoints",
  "feature-flags",
  "integration",
  "web-profile",
  "environment",
  "custom-json",
];
const ENVIRONMENTS = ["development", "staging", "production", "custom"];
const STATUSES = ["active", "draft", "archived"];

function mapSort(sort?: { key: string; direction: "asc" | "desc" } | null): string {
  if (!sort) return "newest";
  if (sort.key === "name") return sort.direction === "asc" ? "name" : "name_desc";
  if (sort.key === "created_at") return sort.direction === "asc" ? "oldest" : "newest";
  return "updated";
}

interface ConfigsExplorerProps {
  initialSearch?: string;
  initialStatus?: string;
  autoImport?: boolean;
}

export function ConfigsExplorer({
  initialSearch = "",
  initialStatus = "",
  autoImport = false,
}: ConfigsExplorerProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [state, setState] = React.useState<DataTableState>({
    page: 1,
    pageSize: 20,
    search: initialSearch || undefined,
  });
  const [filters, setFilters] = React.useState({
    status: STATUSES.includes(initialStatus) ? initialStatus : "",
    type: "",
    environment: "",
    collectionId: "",
    tag: "",
  });
  const [rows, setRows] = React.useState<ConfigSummary[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [collections, setCollections] = React.useState<{ id: string; name: string }[]>([]);
  const [tags, setTags] = React.useState<{ id: string; name: string }[]>([]);
  const [importOpen, setImportOpen] = React.useState(autoImport);
  const [deleteTarget, setDeleteTarget] = React.useState<ConfigSummary | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [refreshToken, setRefreshToken] = React.useState(0);

  // Server-side fetch. All state updates happen in the async continuation,
  // never synchronously in the effect body.
  React.useEffect(() => {
    let cancelled = false;
    const s = state;
    const f = filters;
    void (async () => {
      const res = await listConfigsAction({
        search: s.search || undefined,
        status: f.status || undefined,
        type: f.type || undefined,
        environment: f.environment || undefined,
        collectionId: f.collectionId || undefined,
        tag: f.tag || undefined,
        sort: mapSort(s.sort),
        page: s.page,
        pageSize: s.pageSize,
      });
      if (cancelled) return;
      if (res.ok) {
        setRows(res.data.items);
        setTotal(res.data.total);
        setError(null);
      } else {
        setError(res.error.message);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // state/filters are read via the captured copies above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.page, state.pageSize, state.search, state.sort, filters, refreshToken]);

  // Initial option lists (collections, tags).
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [cRes, tRes] = await Promise.all([
        listCollectionsAction({ page: 1, pageSize: 100 }),
        listTagsAction({ page: 1, pageSize: 200 }),
      ]);
      if (cancelled) return;
      if (cRes.ok) setCollections(cRes.data.items.map((c) => ({ id: c.id, name: c.name })));
      if (tRes.ok) setTags(tRes.data.items.map((t) => ({ id: t.id, name: t.name })));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = () => {
    setSelected([]);
    setLoading(true);
    setRefreshToken((t) => t + 1);
  };

  const handleStateChange = (next: DataTableState) => {
    setLoading(true);
    setState(next);
  };

  const setFilter = (key: keyof typeof filters, value: string) => {
    setLoading(true);
    setFilters((prev) => ({ ...prev, [key]: value }));
    setState((prev) => ({ ...prev, page: 1 }));
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  /* ---------------------------- mutations --------------------------- */

  const doArchive = async (row: ConfigSummary) => {
    const res = await archiveConfigAction(row.id);
    if (res.ok) {
      toast({ title: "Archived", description: `"${row.name}" was archived.`, variant: "success" });
      refresh();
    } else {
      toast({ title: "Archive failed", description: res.error.message, variant: "error" });
    }
  };

  const doRestore = async (row: ConfigSummary) => {
    const res = await restoreConfigAction(row.id);
    if (res.ok) {
      toast({ title: "Restored", description: `"${row.name}" is active again.`, variant: "success" });
      refresh();
    } else {
      toast({ title: "Restore failed", description: res.error.message, variant: "error" });
    }
  };

  const doDuplicate = async (row: ConfigSummary) => {
    const res = await duplicateConfigAction(row.id);
    if (res.ok) {
      toast({ title: "Duplicated", description: `Created "${res.data.name}".`, variant: "success" });
      router.push(`/app/configs/${res.data.id}`);
    } else {
      toast({ title: "Duplicate failed", description: res.error.message, variant: "error" });
    }
  };

  const doDelete = async (row: ConfigSummary) => {
    const res = await deleteConfigAction(row.id);
    if (res.ok) {
      toast({ title: "Deleted", description: `"${row.name}" was permanently deleted.`, variant: "success" });
    } else {
      toast({ title: "Delete failed", description: res.error.message, variant: "error" });
    }
    setDeleteTarget(null);
    refresh();
  };

  const doExport = async (ids: string[]) => {
    const res = await bulkExportAction(ids);
    if (res.ok) {
      downloadExport(res.data.filename, res.data.payload);
      toast({
        title: "Export ready",
        description: `${ids.length} configuration${ids.length === 1 ? "" : "s"} downloaded.`,
        variant: "success",
      });
    } else {
      toast({ title: "Export failed", description: res.error.message, variant: "error" });
    }
  };

  const doBulkArchive = async (ids: string[]) => {
    const res = await bulkArchiveAction(ids);
    if (res.ok) {
      const { archived, failed } = res.data;
      toast({
        title: "Bulk archive complete",
        description:
          failed.length > 0
            ? `${archived} archived, ${failed.length} failed.`
            : `${archived} configuration${archived === 1 ? "" : "s"} archived.`,
        variant: failed.length > 0 ? "warning" : "success",
      });
      refresh();
    } else {
      toast({ title: "Bulk archive failed", description: res.error.message, variant: "error" });
    }
  };

  const doBulkDelete = async (ids: string[]) => {
    const res = await bulkDeleteAction(ids);
    if (res.ok) {
      toast({
        title: "Deleted",
        description: `${res.data.deleted} configuration${res.data.deleted === 1 ? "" : "s"} permanently deleted.`,
        variant: "success",
      });
    } else {
      toast({ title: "Bulk delete failed", description: res.error.message, variant: "error" });
    }
    setBulkDeleteOpen(false);
    refresh();
  };

  /* ------------------------------ table ----------------------------- */

  const columns: DataTableColumn<ConfigSummary>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      cell: (row) => (
        <Link
          href={`/app/configs/${row.id}`}
          className="font-medium text-[var(--aidify-text)] hover:text-[var(--aidify-cyan)] hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: "config_type",
      header: "Type",
      cell: (row) => (
        <span className="text-[var(--aidify-secondary)]">{row.config_type}</span>
      ),
    },
    {
      key: "environment",
      header: "Environment",
      cell: (row) => (
        <Badge variant="info">{row.environment}</Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <Badge variant={STATUS_VARIANT[row.status] ?? "muted"}>{row.status}</Badge>
      ),
    },
    {
      key: "collection",
      header: "Collection",
      cell: (row) => (
        <span className="text-[var(--aidify-secondary)]">{row.collection?.name ?? "—"}</span>
      ),
    },
    {
      key: "updated_at",
      header: "Updated",
      sortable: true,
      cell: (row) =>
        new Date(row.updated_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
    },
  ];

  const rowActions = (row: ConfigSummary) => (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${row.name}`}
        className="rounded-lg p-1.5 text-[var(--aidify-secondary)] hover:bg-white/[0.06] hover:text-[var(--aidify-text)]"
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(`/app/configs/${row.id}`)}>
          <Eye aria-hidden="true" /> View
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/app/configs/${row.id}/edit`)}>
          <Pencil aria-hidden="true" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void doDuplicate(row)}>
          <Copy aria-hidden="true" /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void doExport([row.id])}>
          <Download aria-hidden="true" /> Export
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {row.status === "archived" ? (
          <DropdownMenuItem onClick={() => void doRestore(row)}>
            <ArchiveRestore aria-hidden="true" /> Restore
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => void doArchive(row)}>
            <Archive aria-hidden="true" /> Archive
          </DropdownMenuItem>
        )}
        <DropdownMenuItem danger onClick={() => setDeleteTarget(row)}>
          <Trash2 aria-hidden="true" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const filterSelect = (
    label: string,
    value: string,
    options: { value: string; label: string }[],
    onChange: (v: string) => void,
  ) => (
    <Select value={value || "__all"} onValueChange={(v) => onChange(v === "__all" ? "" : v)}>
      <SelectTrigger aria-label={label} className="w-[150px]">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all">All {label.toLowerCase()}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button asChild>
          <Link href="/app/configs/new">
            <Plus aria-hidden="true" />
            New configuration
          </Link>
        </Button>
        <Button variant="secondary" onClick={() => setImportOpen(true)}>
          <Upload aria-hidden="true" />
          Import
        </Button>
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilters({ status: "", type: "", environment: "", collectionId: "", tag: "" });
              setState((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <X aria-hidden="true" />
            Clear filters ({activeFilterCount})
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        total={total}
        state={state}
        onChange={handleStateChange}
        getRowId={(r) => r.id}
        loading={loading}
        error={error}
        onRetry={refresh}
        selectable
        selectedIds={selected}
        onSelectionChange={setSelected}
        searchPlaceholder="Search configurations…"
        toolbar={
          <>
            {filterSelect("Status", filters.status, STATUSES.map((s) => ({ value: s, label: s })), (v) => setFilter("status", v))}
            {filterSelect("Type", filters.type, TYPES.map((t) => ({ value: t, label: t })), (v) => setFilter("type", v))}
            {filterSelect("Environment", filters.environment, ENVIRONMENTS.map((e) => ({ value: e, label: e })), (v) => setFilter("environment", v))}
            {filterSelect("Collection", filters.collectionId, collections.map((c) => ({ value: c.id, label: c.name })), (v) => setFilter("collectionId", v))}
            {filterSelect("Tag", filters.tag, tags.map((t) => ({ value: t.name, label: t.name })), (v) => setFilter("tag", v))}
          </>
        }
        bulkActions={(ids) => (
          <>
            <Button size="sm" variant="secondary" onClick={() => void doBulkArchive(ids)}>
              <Archive aria-hidden="true" />
              Archive
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void doExport(ids)}>
              <Download aria-hidden="true" />
              Export
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 aria-hidden="true" />
              Delete
            </Button>
          </>
        )}
        rowActions={rowActions}
        emptyState={
          <EmptyState
            title="No configurations found"
            description={
              activeFilterCount > 0 || state.search
                ? "Nothing matches your current search and filters."
                : "Create your first configuration or import existing ones."
            }
          />
        }
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={refresh}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete configuration"
        description={
          deleteTarget && (
            <>
              Permanently delete <strong className="text-[var(--aidify-text)]">“{deleteTarget.name}”</strong>?
              Its version history will be deleted too. This cannot be undone.
            </>
          )
        }
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (deleteTarget) void doDelete(deleteTarget);
        }}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Delete configurations"
        description={
          <>
            Permanently delete <strong className="text-[var(--aidify-text)]">{selected.length} configuration{selected.length === 1 ? "" : "s"}</strong>?
            Version history will be deleted too. This cannot be undone.
          </>
        }
        confirmLabel="Delete all"
        danger
        onConfirm={() => doBulkDelete(selected)}
      />
    </div>
  );
}
