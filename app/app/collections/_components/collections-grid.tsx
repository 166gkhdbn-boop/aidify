"use client";

import * as React from "react";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  FolderInput,
  Archive,
  ArchiveRestore,
  Trash2,
} from "lucide-react";
import {
  Button,
  Badge,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  EmptyState,
  Skeleton,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import {
  listCollectionsAction,
  archiveCollectionAction,
  restoreCollectionAction,
  deleteCollectionAction,
} from "@/actions/collections";
import type { CollectionRow } from "@/lib/dal/types";
import type { CollectionWithCount } from "@/lib/dal/collections";
import { ConfirmDialog } from "@/app/app/_components/confirm-dialog";
import { CollectionDialog } from "./collection-dialog";
import { MoveConfigsDialog } from "./move-configs-dialog";
import { collectionIcon } from "./collection-icons";

/**
 * Collections grid: cards with config counts and full lifecycle actions.
 * Deleting a collection never deletes configurations — they are unassigned.
 */
export function CollectionsGrid({ autoNew = false }: { autoNew?: boolean }) {
  const { toast } = useToast();
  const [items, setItems] = React.useState<CollectionWithCount[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [dialogOpen, setDialogOpen] = React.useState(autoNew);
  const [editing, setEditing] = React.useState<CollectionRow | null>(null);
  const [moving, setMoving] = React.useState<CollectionWithCount | null>(null);
  const [deleting, setDeleting] = React.useState<CollectionWithCount | null>(null);

  // All state updates happen in the async continuation, never synchronously
  // in the effect body.
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await listCollectionsAction({ page: 1, pageSize: 100 });
      if (cancelled) return;
      if (res.ok) {
        setItems(res.data.items);
      } else {
        toast({ title: "Could not load collections", description: res.error.message, variant: "error" });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  const refresh = () => {
    setLoading(true);
    setRefreshToken((t) => t + 1);
  };

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const doArchive = async (c: CollectionWithCount) => {
    const res = c.archived_at
      ? await restoreCollectionAction(c.id)
      : await archiveCollectionAction(c.id);
    if (res.ok) {
      toast({
        title: c.archived_at ? "Collection restored" : "Collection archived",
        variant: "success",
      });
      refresh();
    } else {
      toast({ title: "Action failed", description: res.error.message, variant: "error" });
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    const res = await deleteCollectionAction(deleting.id);
    setDeleting(null);
    if (res.ok) {
      toast({
        title: "Collection deleted",
        description:
          res.data.unassigned > 0
            ? `"${deleting.name}" was deleted. ${res.data.unassigned} configuration${res.data.unassigned === 1 ? " was" : "s were"} unassigned — nothing was deleted.`
            : `"${deleting.name}" was deleted.`,
        variant: "success",
      });
      refresh();
    } else {
      toast({ title: "Delete failed", description: res.error.message, variant: "error" });
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-44" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Button onClick={openNew}>
          <Plus aria-hidden="true" />
          New collection
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No collections yet"
          description="Group related configurations into collections to keep them organized."
          action={{ label: "New collection", onClick: openNew, icon: Plus }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((c) => {
            const Icon = collectionIcon(c.icon);
            const color = c.color ?? "#438BFF";
            return (
              <Card
                key={c.id}
                className="glass-panel-hover relative overflow-hidden"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ background: `linear-gradient(90deg, ${color}, transparent)` }}
                />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex size-11 items-center justify-center rounded-xl border"
                        style={{
                          color,
                          borderColor: `${color}44`,
                          background: `${color}14`,
                        }}
                      >
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-[var(--aidify-text)]">
                          {c.name}
                        </h3>
                        <p className="text-xs text-[var(--aidify-secondary)]">
                          {c.config_count} configuration{c.config_count === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={`Actions for ${c.name}`}
                        className="rounded-lg p-1.5 text-[var(--aidify-secondary)] hover:bg-white/[0.06] hover:text-[var(--aidify-text)]"
                      >
                        <MoreHorizontal className="size-4" aria-hidden="true" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditing(c);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil aria-hidden="true" /> Rename / edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setMoving(c)}>
                          <FolderInput aria-hidden="true" /> Move configurations
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void doArchive(c)}>
                          {c.archived_at ? (
                            <>
                              <ArchiveRestore aria-hidden="true" /> Restore
                            </>
                          ) : (
                            <>
                              <Archive aria-hidden="true" /> Archive
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem danger onClick={() => setDeleting(c)}>
                          <Trash2 aria-hidden="true" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {c.description && (
                    <p className="mt-3 line-clamp-2 text-sm text-[var(--aidify-secondary)]">
                      {c.description}
                    </p>
                  )}
                  <div className="mt-4 flex items-center justify-between">
                    {c.archived_at ? (
                      <Badge variant="muted">Archived</Badge>
                    ) : (
                      <Badge variant="info">Active</Badge>
                    )}
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setMoving(c)}
                      aria-label={`Move configurations into ${c.name}`}
                    >
                      Manage configs
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CollectionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        collection={editing}
        onSaved={refresh}
      />

      {moving && (
        <MoveConfigsDialog
          open={moving !== null}
          onOpenChange={(open) => !open && setMoving(null)}
          collection={moving}
          onMoved={refresh}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete collection"
        description={
          deleting && (
            <>
              Delete the collection{" "}
              <strong className="text-[var(--aidify-text)]">“{deleting.name}”</strong>?
              Its {deleting.config_count} configuration{deleting.config_count === 1 ? "" : "s"} will
              be <strong className="text-[var(--aidify-text)]">unassigned, not deleted</strong>.
              This cannot be undone.
            </>
          )
        }
        confirmLabel="Delete collection"
        danger
        onConfirm={doDelete}
      />
    </div>
  );
}
