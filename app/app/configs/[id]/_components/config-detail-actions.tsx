"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Copy,
  Archive,
  ArchiveRestore,
  Trash2,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/toast";
import {
  archiveConfigAction,
  restoreConfigAction,
  deleteConfigAction,
  duplicateConfigAction,
  bulkExportAction,
} from "@/actions/configs";
import type { ConfigDetail } from "@/lib/dal/types";
import { ConfirmDialog } from "@/app/app/_components/confirm-dialog";
import { downloadExport } from "@/app/app/configs/_components/export-utils";

/** Header actions for the config detail page (all real, all confirmed). */
export function ConfigDetailActions({ config }: { config: ConfigDetail }) {
  const router = useRouter();
  const { toast } = useToast();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const run = async (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, okMsg: string) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res.ok) {
      toast({ title: "Done", description: okMsg, variant: "success" });
      router.refresh();
    } else {
      toast({ title: "Action failed", description: res.error?.message, variant: "error" });
    }
  };

  const duplicate = async () => {
    setBusy(true);
    const res = await duplicateConfigAction(config.id);
    setBusy(false);
    if (res.ok) {
      toast({ title: "Duplicated", description: `Created "${res.data.name}".`, variant: "success" });
      router.push(`/app/configs/${res.data.id}`);
    } else {
      toast({ title: "Duplicate failed", description: res.error.message, variant: "error" });
    }
  };

  const exportOne = async () => {
    const res = await bulkExportAction([config.id]);
    if (res.ok) {
      downloadExport(res.data.filename, res.data.payload);
      toast({ title: "Export ready", description: "Configuration downloaded.", variant: "success" });
    } else {
      toast({ title: "Export failed", description: res.error.message, variant: "error" });
    }
  };

  const remove = async () => {
    setBusy(true);
    const res = await deleteConfigAction(config.id);
    setBusy(false);
    setDeleteOpen(false);
    if (res.ok) {
      toast({ title: "Deleted", description: `"${config.name}" was permanently deleted.`, variant: "success" });
      router.push("/app/configs");
      router.refresh();
    } else {
      toast({ title: "Delete failed", description: res.error.message, variant: "error" });
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild>
          <Link href={`/app/configs/${config.id}/edit`}>
            <Pencil aria-hidden="true" />
            Edit
          </Link>
        </Button>
        <Button variant="secondary" onClick={duplicate} disabled={busy}>
          <Copy aria-hidden="true" />
          Duplicate
        </Button>
        {config.status === "archived" ? (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void run(() => restoreConfigAction(config.id), `"${config.name}" is active again.`)}
          >
            <ArchiveRestore aria-hidden="true" />
            Restore
          </Button>
        ) : (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void run(() => archiveConfigAction(config.id), `"${config.name}" was archived.`)}
          >
            <Archive aria-hidden="true" />
            Archive
          </Button>
        )}
        <Button variant="secondary" onClick={exportOne} disabled={busy}>
          <Download aria-hidden="true" />
          Export
        </Button>
        <Button variant="destructive" onClick={() => setDeleteOpen(true)} disabled={busy}>
          <Trash2 aria-hidden="true" />
          Delete
        </Button>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete configuration"
        description={
          <>
            Permanently delete <strong className="text-[var(--aidify-text)]">“{config.name}”</strong>?
            Its {config.version} version{config.version === 1 ? "" : "s"} will be deleted too.
            This cannot be undone.
          </>
        }
        confirmLabel="Delete"
        danger
        onConfirm={remove}
      />
    </>
  );
}
