"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  checkRateLimit,
  type RateLimitConfig,
} from "@/lib/rate-limit";
import { getSafeRedirect } from "@/lib/safe-redirect";
import {
  ApiErrorCode,
  type ApiError,
} from "@/lib/api-response";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  zodIssuesToFieldErrors,
} from "@/lib/validators";
import { logSecurityEvent } from "@/lib/security-events";
import { ensureProfile } from "@/lib/profile";

/**
 * Auth server actions (brief §05). Client components import these from
 * `@/actions/auth`. Every action:
 * - validates input with zod (server-side, never trusts the client),
 * - is rate-limited per IP,
 * - logs a row to `security_events` (via lib/security-events.ts),
 * - returns an AuthActionResponse with client-safe messages only.
 */

/** AuthActionResponse extends the ApiError envelope with optional field errors. */
export interface AuthActionError extends ApiError {
  fieldErrors?: Record<string, string>;
}

export type AuthActionResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: AuthActionError };

function authOk<T>(data: T): AuthActionResponse<T> {
  return { ok: true, data };
}

function authErr(
  code: string,
  message: string,
  fieldErrors?: Record<string, string>,
): AuthActionResponse<never> {
  return {
    ok: false,
    error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) },
  };
}

/* ------------------------------------------------------------------ */
/* Request helpers                                                     */
/* ------------------------------------------------------------------ */

async function getClientIp(): Promise<string> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headerStore.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

/** Public origin for building email redirect links (Supabase allowlist-checked). */
async function getPublicOrigin(): Promise<string> {
  const headerStore = await headers();
  const proto =
    headerStore.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "https";
  const host =
    headerStore.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    headerStore.get("host")?.trim() ??
    "localhost:3000";
  return `${proto}://${host}`;
}

async function enforceRateLimit(
  route: string,
  config: RateLimitConfig,
): Promise<AuthActionResponse<never> | null> {
  const ip = await getClientIp();
  const result = checkRateLimit(`${ip}:${route}`, config);
  if (!result.allowed) {
    const seconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
    return authErr(
      ApiErrorCode.RATE_LIMITED,
      `Too many attempts. Please wait ${seconds} second${seconds === 1 ? "" : "s"} and try again.`,
    );
  }
  return null;
}

function ensureSupabaseConfigured(): AuthActionResponse<never> | null {
  if (!isSupabaseConfigured()) {
    return authErr(
      ApiErrorCode.NOT_CONFIGURED,
      "Supabase is not configured. Set the environment variables (see .env.example) and restart the app.",
    );
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* signInAction — email + password → session + safe redirect target     */
/* ------------------------------------------------------------------ */

const signInActionSchema = loginSchema.extend({
  /** Post-login destination, validated with open-redirect protection. */
  next: z.string().optional(),
});

export async function signInAction(
  input: unknown,
): Promise<AuthActionResponse<{ redirectTo: string }>> {
  const limited = await enforceRateLimit("sign-in", {
    limit: 5,
    windowMs: 60_000,
  });
  if (limited) return limited;
  const notConfigured = ensureSupabaseConfigured();
  if (notConfigured) return notConfigured;

  const parsed = signInActionSchema.safeParse(input);
  if (!parsed.success) {
    return authErr(
      ApiErrorCode.VALIDATION,
      "Please check the highlighted fields.",
      zodIssuesToFieldErrors(parsed.error),
    );
  }
  const { email, password, next } = parsed.data;

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return authErr(
      ApiErrorCode.NOT_CONFIGURED,
      "Supabase is not configured. Set the environment variables (see .env.example) and restart the app.",
    );
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    // Generic message on purpose: never reveal whether the email exists.
    await logSecurityEvent({
      eventType: "login_failed",
      metadata: { reason: error?.message ?? "unknown" },
    });
    return authErr(ApiErrorCode.UNAUTHENTICATED, "Invalid email or password.");
  }

  const metadataName = data.user.user_metadata?.["display_name"];
  await ensureProfile({
    id: data.user.id,
    email: data.user.email,
    displayName: typeof metadataName === "string" ? metadataName : undefined,
  });
  await logSecurityEvent({
    eventType: "login_success",
    userId: data.user.id,
  });

  return authOk({ redirectTo: getSafeRedirect(next, "/app") });
}

/* ------------------------------------------------------------------ */
/* signUpAction — register, then require email verification            */
/* ------------------------------------------------------------------ */

export async function signUpAction(
  input: unknown,
): Promise<AuthActionResponse<{ email: string }>> {
  const limited = await enforceRateLimit("sign-up", {
    limit: 3,
    windowMs: 60_000,
  });
  if (limited) return limited;
  const notConfigured = ensureSupabaseConfigured();
  if (notConfigured) return notConfigured;

  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return authErr(
      ApiErrorCode.VALIDATION,
      "Please check the highlighted fields.",
      zodIssuesToFieldErrors(parsed.error),
    );
  }
  const { email, password, displayName } = parsed.data;

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return authErr(
      ApiErrorCode.NOT_CONFIGURED,
      "Supabase is not configured. Set the environment variables (see .env.example) and restart the app.",
    );
  }

  const origin = await getPublicOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/app")}`,
    },
  });

  if (error) {
    // Anti-enumeration: an already-registered address gets the same
    // "check your inbox" state as a brand-new one.
    if (!/already registered|already exists/i.test(error.message)) {
      return authErr(ApiErrorCode.CONFLICT, error.message);
    }
  }

  if (data.user) {
    await ensureProfile({
      id: data.user.id,
      email: data.user.email,
      displayName,
    });
    await logSecurityEvent({
      eventType: "registered",
      userId: data.user.id,
    });
  }

  // Never auto-log-in and never reveal whether the address already existed:
  // the client shows "Check your inbox to verify" in all success cases.
  return authOk({ email });
}

/* ------------------------------------------------------------------ */
/* signOutAction                                                       */
/* ------------------------------------------------------------------ */

export async function signOutAction(): Promise<
  AuthActionResponse<{ signedOut: true }>
> {
  const notConfigured = ensureSupabaseConfigured();
  if (notConfigured) return notConfigured;

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return authErr(
      ApiErrorCode.NOT_CONFIGURED,
      "Supabase is not configured.",
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return authErr(
      ApiErrorCode.INTERNAL,
      "Could not sign out. Please try again.",
    );
  }

  if (user) {
    await logSecurityEvent({ eventType: "logout", userId: user.id });
  }

  return authOk({ signedOut: true });
}

/* ------------------------------------------------------------------ */
/* requestPasswordResetAction — always the generic success message      */
/* ------------------------------------------------------------------ */

export async function requestPasswordResetAction(
  input: unknown,
): Promise<AuthActionResponse<{ message: string }>> {
  const limited = await enforceRateLimit("password-reset-request", {
    limit: 3,
    windowMs: 60_000,
  });
  if (limited) return limited;
  const notConfigured = ensureSupabaseConfigured();
  if (notConfigured) return notConfigured;

  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return authErr(
      ApiErrorCode.VALIDATION,
      "Please check the highlighted fields.",
      zodIssuesToFieldErrors(parsed.error),
    );
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return authErr(
      ApiErrorCode.NOT_CONFIGURED,
      "Supabase is not configured. Set the environment variables (see .env.example) and restart the app.",
    );
  }

  const origin = await getPublicOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/reset-password`,
  });

  // No enumeration: user_id stays null, the email never leaves this server.
  await logSecurityEvent({
    eventType: "password_reset_requested",
    metadata: { ok: !error },
  });

  // ALWAYS the same message, whether the account exists or not.
  return authOk({
    message:
      "If an account exists for this email, a password reset link has been sent.",
  });
}

/* ------------------------------------------------------------------ */
/* updatePasswordAction — completes the recovery-link flow              */
/* ------------------------------------------------------------------ */

export async function updatePasswordAction(
  input: unknown,
): Promise<AuthActionResponse<{ changed: true }>> {
  const limited = await enforceRateLimit("password-reset-complete", {
    limit: 5,
    windowMs: 60_000,
  });
  if (limited) return limited;
  const notConfigured = ensureSupabaseConfigured();
  if (notConfigured) return notConfigured;

  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return authErr(
      ApiErrorCode.VALIDATION,
      "Please check the highlighted fields.",
      zodIssuesToFieldErrors(parsed.error),
    );
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return authErr(
      ApiErrorCode.NOT_CONFIGURED,
      "Supabase is not configured. Set the environment variables (see .env.example) and restart the app.",
    );
  }

  // The recovery session must already exist (established by the browser
  // client from the URL hash; its cookies reach this action).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return authErr(
      ApiErrorCode.UNAUTHENTICATED,
      "This reset link is invalid or has expired. Please request a new one.",
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return authErr(
      ApiErrorCode.INTERNAL,
      "Could not update your password. Please request a new reset link and try again.",
    );
  }

  await logSecurityEvent({ eventType: "password_changed", userId: user.id });

  return authOk({ changed: true });
}
