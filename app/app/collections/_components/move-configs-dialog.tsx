"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Checkbox,
  EmptyState,
  Skeleton,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { listConfigsAction } from "@/actions/configs";
import { moveConfigsAction } from "@/actions/collections";
import type { CollectionWithCount } from "@/lib/dal/collections";

interface MoveConfigsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection: CollectionWithCount;
  onMoved: () => void;
}

/**
 * Move-configs dialog: lists the user's configurations with checkboxes;
 * selected ones are assigned to this collection.
 */
export function MoveConfigsDialog({
  open,
  onOpenChange,
  collection,
  onMoved,
}: MoveConfigsDialogProps) {
  const { toast } = useToast();
  const [configs, setConfigs] = React.useState<
    { id: string; name: string; collection_id: string | null }[]
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);

  // Reset transient state whenever the dialog (re)opens — React's "adjust
  // state during render" pattern (also used by AppShell/DataTable).
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setSelected([]);
      setSearch("");
      setConfigs([]);
      setLoading(true);
    }
  }

  // Fetch on open; all state updates happen in the async continuation.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const res = await listConfigsAction({ page: 1, pageSize: 200, sort: "name" });
      if (cancelled) return;
      setLoading(false);
      if (res.ok) {
        setConfigs(
          res.data.items.map((c) => ({
            id: c.id,
            name: c.name,
            collection_id: c.collection_id,
          })),
        );
      } else {
        toast({ title: "Could not load configurations", description: res.error.message, variant: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, toast]);

  const filtered = configs.filter((c) =>
    c.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  const save = async () => {
    setSaving(true);
    const res = await moveConfigsAction(collection.id, selected);
    setSaving(false);
    if (res.ok) {
      toast({
        title: "Moved",
        description: `${res.data.moved} configuration${res.data.moved === 1 ? "" : "s"} moved to "${collection.name}".`,
        variant: "success",
      });
      onOpenChange(false);
      onMoved();
    } else {
      toast({ title: "Move failed", description: res.error.message, variant: "error" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Move configurations</DialogTitle>
          <DialogDescription>
            Select configurations to move into “{collection.name}”.
          </DialogDescription>
        </DialogHeader>
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter configurations…"
          aria-label="Filter configurations"
        />
        <div className="max-h-[40vh] overflow-y-auto rounded-xl border border-[var(--aidify-border)]">
          {loading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-5 w-3/5" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No configurations"
              description={search ? "Nothing matches your filter." : "Create a configuration first."}
            />
          ) : (
            <ul className="divide-y divide-[var(--aidify-border)]">
              {filtered.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03]">
                    <Checkbox
                      checked={selected.includes(c.id)}
                      onCheckedChange={() => toggle(c.id)}
                      aria-label={`Move ${c.name}`}
                    />
                    <span className="truncate text-sm text-[var(--aidify-text)]">{c.name}</span>
                    {c.collection_id === collection.id && (
                      <span className="ml-auto text-xs text-[var(--aidify-secondary)]">already here</span>
                    )}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || selected.length === 0}>
            {saving ? "Moving…" : `Move ${selected.length} selected`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
