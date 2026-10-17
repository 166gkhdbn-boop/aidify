"use client";

import * as React from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
  FormError,
} from "@/components/ui";

/**
 * Confirm dialog with an optional/required reason field. Every destructive
 * or moderation action in the admin console goes through this so the reason
 * is always recorded in the audit log.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  requireReason = true,
  reasonLabel = "Reason (recorded in the audit log)",
  reasonPlaceholder = "Explain why you are taking this action…",
  destructive = false,
  busy = false,
  error = null,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  destructive?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: (reason: string | null) => void;
}) {
  const [reason, setReason] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  function handleOpenChange(next: boolean) {
    // Reset the form when the dialog closes (equivalent UX to resetting on
    // open, without setState-inside-effect).
    if (!next) {
      setReason("");
      setTouched(false);
    }
    onOpenChange(next);
  }

  const reasonError =
    requireReason && touched && reason.trim().length === 0
      ? "A reason is required."
      : null;

  function handleConfirm() {
    setTouched(true);
    if (requireReason && reason.trim().length === 0) return;
    onConfirm(requireReason ? reason.trim() : reason.trim() || null);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="confirm-reason">
            {reasonLabel}
            {!requireReason && (
              <span className="ml-1 font-normal text-[var(--aidify-secondary)]">(optional)</span>
            )}
          </Label>
          <Textarea
            id="confirm-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={reasonPlaceholder}
            rows={3}
            maxLength={500}
            aria-invalid={!!reasonError}
          />
          <FormError message={reasonError} />
        </div>

        <FormError message={error} />

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={handleConfirm}
            loading={busy}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
