"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import {
  Button,
  Input,
  Label,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Alert,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { createClient } from "@/lib/supabase/client";
import { deleteAccountAction } from "@/actions/profile";
import { signOutAction } from "@/actions/auth";

/**
 * Delete-account workflow: type DELETE to confirm + re-enter the password
 * (verified with a real sign-in attempt — never stored), then the account
 * and all of its data are permanently wiped and the session is signed out.
 */
export function DeleteAccount({ email }: { email: string | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [confirmText, setConfirmText] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const canDelete = confirmText.trim() === "DELETE" && password.length > 0 && !deleting;

  const run = async () => {
    setError(null);
    if (!email) {
      setError("No email on this account — cannot verify your password.");
      return;
    }
    setDeleting(true);

    // Step 1: verify the password with a real sign-in attempt. This only
    // refreshes the session — nothing is stored client-side.
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      setDeleting(false);
      return;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setError("The password is incorrect. The account was not deleted.");
      setDeleting(false);
      return;
    }

    // Step 2: wipe everything.
    const delRes = await deleteAccountAction();
    if (!delRes.ok) {
      setError(delRes.error.message);
      setDeleting(false);
      return;
    }

    // Step 3: sign out and leave.
    await signOutAction().catch(() => undefined);
    toast({
      title: "Account deleted",
      description: "Your account and all of its data were permanently deleted.",
      variant: "success",
    });
    router.push("/");
    router.refresh();
  };

  return (
    <Card className="glass-panel border-[var(--aidify-error)]/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-[var(--aidify-error)]">
          <AlertTriangle className="size-4" aria-hidden="true" />
          Danger zone
        </CardTitle>
        <CardDescription>
          Deleting your account permanently removes every configuration, collection,
          project, tag, notification and ticket — there is no undo.
        </CardDescription>
      </CardHeader>
      <CardContent className="max-w-md space-y-4">
        <div>
          <Label htmlFor="delete-confirm">Type DELETE to confirm</Label>
          <Input
            id="delete-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
            className="mt-1.5 font-mono"
          />
        </div>
        <div>
          <Label htmlFor="delete-password">Confirm your password</Label>
          <Input
            id="delete-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="mt-1.5"
          />
        </div>
        {error && <Alert variant="error">{error}</Alert>}
        <Button variant="destructive" onClick={run} disabled={!canDelete}>
          {deleting ? "Deleting…" : "Delete my account permanently"}
        </Button>
      </CardContent>
    </Card>
  );
}
