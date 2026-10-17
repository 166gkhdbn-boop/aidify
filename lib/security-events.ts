import "server-only";

import { headers } from "next/headers";
import { createAdminClient } from "./supabase/admin";

/**
 * Security event logging (brief §12: `security_events` table).
 *
 * Written via the service-role client. NEVER throws: a logging failure must
 * never break the auth flow it is observing — failures are reported
 * server-side only.
 *
 * Reusable by any server code (auth flows, services agent, admin actions):
 *   await logSecurityEvent({ eventType: "login_success", userId: user.id });
 */

export const SecurityEventType = {
  /** Successful sign-in (password, callback, or other exchange). */
  login_success: "login_success",
  /** Failed sign-in attempt (wrong credentials, etc.). */
  login_failed: "login_failed",
  /** New account created via /register. */
  registered: "registered",
  /** Email address confirmed through the verification link. */
  email_verified: "email_verified",
  /** Password reset requested (no enumeration — user_id may be null). */
  password_reset_requested: "password_reset_requested",
  /** Password changed (reset flow or settings). */
  password_changed: "password_changed",
  /** User signed out. */
  logout: "logout",
} as const;

export type SecurityEventType =
  (typeof SecurityEventType)[keyof typeof SecurityEventType];

export interface LogSecurityEventInput {
  eventType: SecurityEventType;
  /** Null when the event is not tied to a known user (e.g. failed login). */
  userId?: string | null;
  /** Defaults to the request's client IP. */
  ip?: string;
  /** Defaults to the request's User-Agent. */
  userAgent?: string;
  /** Extra context (must be JSON-serializable, never include secrets). */
  metadata?: Record<string, unknown>;
}

/** Best-effort client IP from request headers. */
function extractIp(headerStore: Headers): string {
  const forwarded = headerStore.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headerStore.get("x-real-ip");
  if (realIp) {
    const trimmed = realIp.trim();
    if (trimmed) return trimmed;
  }
  return "unknown";
}

/**
 * Insert a row into `security_events`. Resolves even when the insert fails.
 */
export async function logSecurityEvent(
  input: LogSecurityEventInput,
): Promise<void> {
  try {
    const headerStore = await headers();
    const admin = createAdminClient();

    const { error } = await admin.from("security_events").insert({
      user_id: input.userId ?? null,
      event_type: input.eventType,
      ip: input.ip ?? extractIp(headerStore),
      user_agent: input.userAgent ?? headerStore.get("user-agent") ?? null,
      metadata: input.metadata ?? {},
    });

    if (error) {
      console.error(
        `[aidify] security event insert failed (${input.eventType}):`,
        error.message,
      );
    }
  } catch (error) {
    // Never break the caller: report and continue.
    console.error(
      `[aidify] security event logging failed (${input.eventType}):`,
      error instanceof Error ? error.message : error,
    );
  }
}
