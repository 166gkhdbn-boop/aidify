"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, Copy, KeyRound, UserCheck } from "lucide-react";
import { Alert, Button, Input, Label } from "@/components/ui";
import { useToast } from "@/components/toast";
import {
  suspendUserAction,
  reactivateUserAction,
  initiateRecoveryAction,
} from "@/actions/admin";
import { ConfirmDialog } from "./confirm-dialog";

/**
 * Moderation actions for one user: suspend / reactivate (reason required,
 * audited) and password-recovery link generation. The recovery link is shown
 * in a copyable field with an honest note — email is NOT sent automatically.
 */
export function UserActions({
  userId,
  username,
  suspended,
  isSelf,
}: {
  userId: string;
  username: string;
  suspended: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [dialog, setDialog] = React.useState<"suspend" | "reactivate" | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [recovery, setRecovery] = React.useState<{ email: string; link: string } | null>(null);
  const [recoveryBusy, setRecoveryBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  async function handleConfirm(reason: string | null) {
    setBusy(true);
    setError(null);
    const result =
      dialog === "suspend"
        ? await suspendUserAction(userId, reason)
        : await reactivateUserAction(userId);
    setBusy(false);
    if (result.ok) {
      setDialog(null);
      toast({
        title: dialog === "suspend" ? "Account suspended" : "Account reactivated",
        description:
          dialog === "suspend"
            ? `${username} can no longer sign in.`
            : `${username} can sign in again.`,
        variant: "success",
      });
      router.refresh();
    } else {
      setError(result.error.message);
    }
  }

  async function handleRecovery() {
    setRecoveryBusy(true);
    setRecovery(null);
    const result = await initiateRecoveryAction(userId);
    setRecoveryBusy(false);
    if (result.ok) {
      setRecovery({ email: result.data.email, link: result.data.recoveryLink });
    } else {
      toast({ title: "Recovery failed", description: result.error.message, variant: "error" });
    }
  }

  async function copyLink() {
    if (!recovery) return;
    try {
      await navigator.clipboard.writeText(recovery.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Select the link manually to copy it.", variant: "warning" });
    }
  }

  return (
    <div className="space-y-4">
      {isSelf && (
        <Alert variant="info" title="This is your own account">
          Suspension controls are disabled for your own account.
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        {suspended ? (
          <Button
            variant="success"
            onClick={() => setDialog("reactivate")}
            disabled={isSelf}
          >
            <UserCheck aria-hidden="true" />
            Reactivate account
          </Button>
        ) : (
          <Button
            variant="destructive"
            onClick={() => setDialog("suspend")}
            disabled={isSelf}
          >
            <Ban aria-hidden="true" />
            Suspend account
          </Button>
        )}
        <Button variant="secondary" onClick={handleRecovery} loading={recoveryBusy}>
          <KeyRound aria-hidden="true" />
          Generate recovery link
        </Button>
      </div>

      {recovery && (
        <div className="space-y-2 rounded-xl border border-[var(--aidify-border)] bg-white/[0.02] p-4">
          <Label htmlFor="recovery-link">
            Recovery link for {recovery.email}
          </Label>
          <div className="flex gap-2">
            <Input
              id="recovery-link"
              readOnly
              value={recovery.link}
              onFocus={(e) => e.target.select()}
              className="font-mono text-xs"
            />
            <Button variant="secondary" size="sm" onClick={copyLink} className="shrink-0">
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-[var(--aidify-secondary)]">
            This link was generated for the user&apos;s email but no email was
            sent — copy it and deliver it to the user yourself through your own
            channel. It expires according to your auth provider&apos;s settings.
          </p>
        </div>
      )}

      <ConfirmDialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDialog(null);
            setError(null);
          }
        }}
        title={dialog === "suspend" ? `Suspend ${username}?` : `Reactivate ${username}?`}
        description={
          dialog === "suspend"
            ? "The user will be signed out and unable to sign in until reactivated. They will be notified."
            : "The user will be able to sign in again. They will be notified."
        }
        confirmLabel={dialog === "suspend" ? "Suspend account" : "Reactivate account"}
        destructive={dialog === "suspend"}
        requireReason={dialog === "suspend"}
        busy={busy}
        error={error}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
