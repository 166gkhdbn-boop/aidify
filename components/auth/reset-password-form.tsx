"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Link2Off, Loader2, LockKeyhole } from "lucide-react";
import { updatePasswordAction, type AuthActionResponse } from "@/actions/auth";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validators";
import { createClient } from "@/lib/supabase/client";
import { Alert, Button, FormError, Input, Label } from "@/components/ui";

type UpdatePasswordResult = AuthActionResponse<{ changed: true }>;

type LinkState = "checking" | "ready" | "invalid" | "done";

/**
 * Reads the recovery session from the URL hash via the browser client
 * (Supabase detects `?type=recovery#access_token=…` automatically).
 * Expired/invalid links get an honest error state with a link back to
 * /forgot-password.
 */
export function ResetPasswordForm() {
  // createClient() is side-effect free (reads env, builds the client), so it
  // is safe to run once during render. When Supabase is not configured the
  // page server-guards with SetupRequired; this is a belt-and-braces fallback.
  const [supabase] = useState(() => createClient());
  const [linkState, setLinkState] = useState<LinkState>(
    supabase ? "checking" : "invalid",
  );
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!supabase) return;

    let settled = false;
    const markReady = () => {
      if (!settled) {
        settled = true;
        setLinkState("ready");
      }
    };

    // The browser client processes the hash on creation; getSession settles
    // the common case, and the PASSWORD_RECOVERY event covers late detection.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) markReady();
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) markReady();
    });

    // If nothing established a session shortly after load, the link is bad.
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        setLinkState("invalid");
      }
    }, 4000);

    return () => {
      settled = true;
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function onSubmit(values: ResetPasswordInput) {
    setServerError(null);
    const result: UpdatePasswordResult = await updatePasswordAction(values);

    if (!result.ok) {
      if (result.error.fieldErrors) {
        for (const [field, message] of Object.entries(result.error.fieldErrors)) {
          if (field === "password" || field === "confirmPassword") {
            setError(field, { type: "server", message });
          } else {
            setServerError(message);
          }
        }
      } else if (result.error.code === "UNAUTHENTICATED") {
        setLinkState("invalid");
      } else {
        setServerError(result.error.message);
      }
      return;
    }

    setLinkState("done");
  }

  if (linkState === "checking") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Loader2
          className="size-8 animate-spin text-[var(--aidify-cyan)]"
          aria-hidden="true"
        />
        <p className="text-sm text-[var(--aidify-secondary)]">
          Verifying your reset link…
        </p>
      </div>
    );
  }

  if (linkState === "invalid") {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-[var(--aidify-error)]/30 bg-[var(--aidify-error)]/10">
          <Link2Off className="size-7 text-[var(--aidify-error)]" aria-hidden="true" />
        </div>
        <Alert variant="error" title="This reset link is invalid or expired">
          <p>
            Reset links are single-use and expire after a short time. Request a
            fresh one and try again.
          </p>
        </Alert>
        <Button variant="secondary" className="w-full" size="lg" asChild>
          <Link href="/forgot-password">Request a new reset link</Link>
        </Button>
      </div>
    );
  }

  if (linkState === "done") {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-[var(--aidify-success)]/30 bg-[var(--aidify-success)]/10">
          <CheckCircle2
            className="size-7 text-[var(--aidify-success)]"
            aria-hidden="true"
          />
        </div>
        <Alert variant="success" title="Password updated">
          <p>
            Your password has been changed. Sign in with your new password to
            continue.
          </p>
        </Alert>
        <Button className="w-full" size="lg" asChild>
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {serverError && (
        <Alert variant="error" className="mb-1">
          <p>{serverError}</p>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="reset-password" required>
          New password
        </Label>
        <Input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "reset-password-error" : undefined}
          {...register("password")}
        />
        <FormError id="reset-password-error" message={errors.password?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reset-confirm" required>
          Confirm new password
        </Label>
        <Input
          id="reset-confirm"
          type="password"
          autoComplete="new-password"
          placeholder="Repeat your new password"
          aria-invalid={!!errors.confirmPassword}
          aria-describedby={errors.confirmPassword ? "reset-confirm-error" : undefined}
          {...register("confirmPassword")}
        />
        <FormError id="reset-confirm-error" message={errors.confirmPassword?.message} />
      </div>

      <Button
        type="submit"
        className="w-full"
        size="lg"
        loading={isSubmitting}
        disabled={isSubmitting}
      >
        {!isSubmitting && <LockKeyhole aria-hidden="true" />}
        {isSubmitting ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
