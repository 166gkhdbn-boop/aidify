"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { useToast } from "@/components/toast";
import {
  moderateArchiveAction,
  moderateDeleteAction,
  moderateRestoreAction,
} from "@/actions/admin";
import { ConfirmDialog } from "./confirm-dialog";

type PendingAction = "archive" | "restore" | "delete";

/**
 * Moderation actions for one configuration. Archive / restore / delete each
 * require a typed reason, are audit-logged server-side, and notify the owner.
 * Moderators and administrators may act here.
 */
export function ConfigModeration({
  configId,
  configName,
  status,
}: {
  configId: string;
  configName: string;
  status: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = React.useState<PendingAction | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const copy: Record<
    PendingAction,
    { title: string; description: string; confirm: string; destructive: boolean }
  > = {
    archive: {
      title: `Archive "${configName}"?`,
      description:
        "The configuration becomes read-only for its owner but keeps its data and version history.",
      confirm: "Archive configuration",
      destructive: false,
    },
    restore: {
      title: `Restore "${configName}"?`,
      description: "The configuration returns to active status for its owner.",
      confirm: "Restore configuration",
      destructive: false,
    },
    delete: {
      title: `Delete "${configName}"?`,
      description:
        "This permanently removes the configuration and its version history. This cannot be undone.",
      confirm: "Delete permanently",
      destructive: true,
    },
  };

  async function handleConfirm(reason: string | null) {
    if (!pending || !reason) return;
    setBusy(true);
    setError(null);
    const result =
      pending === "archive"
        ? await moderateArchiveAction(configId, reason)
        : pending === "restore"
          ? await moderateRestoreAction(configId, reason)
          : await moderateDeleteAction(configId, reason);
    setBusy(false);
    if (result.ok) {
      const active = copy[pending];
      setPending(null);
      toast({ title: active.confirm, description: "The owner has been notified.", variant: "success" });
      if (pending === "delete") {
        router.push("/admin/configs");
      } else {
        router.refresh();
      }
    } else {
      setError(result.error.message);
    }
  }

  const isArchived = status === "archived";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {isArchived ? (
          <Button variant="secondary" onClick={() => setPending("restore")}>
            <ArchiveRestore aria-hidden="true" />
            Restore to active
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => setPending("archive")}>
            <Archive aria-hidden="true" />
            Archive
          </Button>
        )}
        <Button variant="destructive" onClick={() => setPending("delete")}>
          <Trash2 aria-hidden="true" />
          Delete
        </Button>
      </div>
      <Alert variant="info" title="Moderation is audited">
        The action, your identity, the target, and your reason are written to
        the append-only audit log, and the configuration owner is notified.
      </Alert>

      {pending && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setPending(null);
              setError(null);
            }
          }}
          title={copy[pending].title}
          description={copy[pending].description}
          confirmLabel={copy[pending].confirm}
          destructive={copy[pending].destructive}
          requireReason
          busy={busy}
          error={error}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
