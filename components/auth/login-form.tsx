"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn } from "lucide-react";
import { signInAction, type AuthActionResponse } from "@/actions/auth";
import { loginSchema, type LoginInput } from "@/lib/validators";
import {
  ApiErrorCode,
} from "@/lib/api-response";
import { Alert, Button, FormError, Input, Label } from "@/components/ui";

type SignInResult = AuthActionResponse<{ redirectTo: string }>;

export function LoginForm({
  next,
  authError,
}: {
  /** Post-login destination requested via ?next= (validated server-side). */
  next?: string;
  /** Human-readable error passed from /auth/callback. */
  authError?: string;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setServerError(null);
    const result: SignInResult = await signInAction({ ...values, next });

    if (!result.ok) {
      if (result.error.fieldErrors) {
        for (const [field, message] of Object.entries(result.error.fieldErrors)) {
          if (field === "email" || field === "password") {
            setError(field, { type: "server", message });
          } else {
            setServerError(message);
          }
        }
      } else if (result.error.code === ApiErrorCode.NOT_CONFIGURED) {
        setServerError(result.error.message);
      } else {
        // RATE_LIMITED, UNAUTHENTICATED, … — message is client-safe.
        setServerError(result.error.message);
      }
      return;
    }

    router.push(result.data.redirectTo);
    router.refresh();
  }

  const emailErrorId = "login-email-error";
  const passwordErrorId = "login-password-error";

  return (
    <>
      {authError && (
        <Alert variant="warning" title="Verification link issue" className="mb-5">
          <p>{authError}</p>
        </Alert>
      )}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {serverError && (
          <Alert variant="error" className="mb-1">
            <p>{serverError}</p>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="login-email" required>
            Email
          </Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? emailErrorId : undefined}
            {...register("email")}
          />
          <FormError id={emailErrorId} message={errors.email?.message} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password" required>
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="text-xs text-[var(--aidify-cyan)] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? passwordErrorId : undefined}
            {...register("password")}
          />
          <FormError id={passwordErrorId} message={errors.password?.message} />
        </div>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          {!isSubmitting && <LogIn aria-hidden="true" />}
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </>
  );
}
