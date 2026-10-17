"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck, UserPlus } from "lucide-react";
import { signUpAction, type AuthActionResponse } from "@/actions/auth";
import { registerSchema, type RegisterInput } from "@/lib/validators";
import { Alert, Button, FormError, Input, Label } from "@/components/ui";

type SignUpResult = AuthActionResponse<{ email: string }>;

export function RegisterForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      displayName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: RegisterInput) {
    setServerError(null);
    const result: SignUpResult = await signUpAction(values);

    if (!result.ok) {
      if (result.error.fieldErrors) {
        for (const [field, message] of Object.entries(result.error.fieldErrors)) {
          if (
            field === "email" ||
            field === "password" ||
            field === "confirmPassword" ||
            field === "displayName"
          ) {
            setError(field, { type: "server", message });
          } else {
            setServerError(message);
          }
        }
      } else {
        setServerError(result.error.message);
      }
      return;
    }

    // Never auto-log-in: the account needs email verification first.
    setRegisteredEmail(result.data.email);
  }

  if (registeredEmail) {
    return (
      <Alert variant="success" title="Check your inbox">
        <p>
          We sent a verification link to{" "}
          <span className="font-medium text-[var(--aidify-text)]">
            {registeredEmail}
          </span>
          . Click it to activate your account, then sign in.
        </p>
        <p className="mt-2">
          Nothing arrived? Check your spam folder — the email can take a few
          minutes.
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
        <Label htmlFor="register-name" required>
          Display name
        </Label>
        <Input
          id="register-name"
          type="text"
          autoComplete="name"
          placeholder="Ada Lovelace"
          aria-invalid={!!errors.displayName}
          aria-describedby={errors.displayName ? "register-name-error" : undefined}
          {...register("displayName")}
        />
        <FormError id="register-name-error" message={errors.displayName?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-email" required>
          Email
        </Label>
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "register-email-error" : undefined}
          {...register("email")}
        />
        <FormError id="register-email-error" message={errors.email?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-password" required>
          Password
        </Label>
        <Input
          id="register-password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "register-password-error" : undefined}
          {...register("password")}
        />
        <FormError id="register-password-error" message={errors.password?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-confirm" required>
          Confirm password
        </Label>
        <Input
          id="register-confirm"
          type="password"
          autoComplete="new-password"
          placeholder="Repeat your password"
          aria-invalid={!!errors.confirmPassword}
          aria-describedby={errors.confirmPassword ? "register-confirm-error" : undefined}
          {...register("confirmPassword")}
        />
        <FormError
          id="register-confirm-error"
          message={errors.confirmPassword?.message}
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        size="lg"
        loading={isSubmitting}
        disabled={isSubmitting}
      >
        {!isSubmitting && <UserPlus aria-hidden="true" />}
        {isSubmitting ? "Creating account…" : "Create account"}
      </Button>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-[var(--aidify-secondary)]">
        <MailCheck className="mt-0.5 size-4 shrink-0 text-[var(--aidify-cyan)]" aria-hidden="true" />
        You will receive a verification email. Your account activates when you
        click the link inside.
      </p>
    </form>
  );
}
