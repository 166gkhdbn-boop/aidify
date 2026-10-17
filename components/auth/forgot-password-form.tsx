"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Send } from "lucide-react";
import {
  requestPasswordResetAction,
  type AuthActionResponse,
} from "@/actions/auth";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validators";
import { Alert, Button, FormError, Input, Label } from "@/components/ui";

type ResetRequestResult = AuthActionResponse<{ message: string }>;

export function ForgotPasswordForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordInput) {
    setServerError(null);
    const result: ResetRequestResult = await requestPasswordResetAction(values);

    if (!result.ok) {
      if (result.error.fieldErrors?.email) {
        setError("email", {
          type: "server",
          message: result.error.fieldErrors.email,
        });
      } else {
        setServerError(result.error.message);
      }
      return;
    }

    // Anti-enumeration: the same message shows whether or not the account exists.
    setSent(true);
  }

  if (sent) {
    return (
      <Alert variant="success" title="Check your inbox">
        <p>
          If an account exists for this email, a password reset link has been
          sent. It expires after a short time — use it promptly.
        </p>
      </Alert>
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
        <Label htmlFor="forgot-email" required>
          Email
        </Label>
        <Input
          id="forgot-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "forgot-email-error" : undefined}
          {...register("email")}
        />
        <FormError id="forgot-email-error" message={errors.email?.message} />
      </div>

      <Button
        type="submit"
        className="w-full"
        size="lg"
        loading={isSubmitting}
        disabled={isSubmitting}
      >
        {!isSubmitting && <Send aria-hidden="true" />}
        {isSubmitting ? "Sending…" : "Send reset link"}
      </Button>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-[var(--aidify-secondary)]">
        <KeyRound
          className="mt-0.5 size-4 shrink-0 text-[var(--aidify-cyan)]"
          aria-hidden="true"
        />
        The link is single-use and expires quickly. For your privacy we never
        say whether an account exists for the address you entered.
      </p>
    </form>
  );
}
