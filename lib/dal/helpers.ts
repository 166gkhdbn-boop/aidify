import "server-only";

import { z } from "zod";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { err, ApiErrorCode, type ApiResponse } from "@/lib/api-response";

/** Shown when Supabase env vars are missing (never fakes auth/data). */
export const SETUP_MESSAGE =
  "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL, " +
  "NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY, then restart the app.";

/**
 * Service-role client, or a NOT_CONFIGURED envelope when the key is missing.
 * Usage:
 *   const admin = getAdminClient();
 *   if ("error" in admin) return admin.error;
 */
export function getAdminClient():
  | { client: SupabaseClient }
  | { error: ApiResponse<never> } {
  try {
    return { client: createAdminClient() };
  } catch {
    return { error: err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE) };
  }
}

/** zod safeParse that returns a VALIDATION envelope on failure. */
export function parseOr<T>(
  schema: z.ZodType<T>,
  input: unknown,
):
  | { ok: true; value: T }
  | { ok: false; error: ApiResponse<never> } {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: err(
        ApiErrorCode.VALIDATION,
        first?.message ?? "Invalid input.",
      ),
    };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Map a PostgREST/DB error to a client-safe envelope.
 * Never leaks constraint names, SQL, or stack traces.
 */
export function dbError(
  error: PostgrestError,
  fallback = "Something went wrong. Please try again later.",
): ApiResponse<never> {
  switch (error.code) {
    case "PGRST116":
      return err(ApiErrorCode.NOT_FOUND, "Not found.");
    case "23505":
      return err(
        ApiErrorCode.CONFLICT,
        "A record with these details already exists.",
      );
    case "23503":
      return err(
        ApiErrorCode.VALIDATION,
        "A referenced record does not exist.",
      );
    case "42501":
      return err(
        ApiErrorCode.FORBIDDEN,
        "You do not have permission to do that.",
      );
    default:
      console.error("[aidify] db error:", error.code, error.message);
      return err(ApiErrorCode.INTERNAL, fallback);
  }
}

/** 404 envelope (used instead of 403 to avoid ID-oracle enumeration). */
export function notFound(message = "Not found."): ApiResponse<never> {
  return err(ApiErrorCode.NOT_FOUND, message);
}

/** Convert 1-based page/pageSize to a PostgREST range. */
export function pageWindow(
  page: number,
  pageSize: number,
): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

/** Escape LIKE wildcards so user search text is matched literally. */
export function escapeLike(term: string): string {
  return term
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

/** UTC calendar-day key (YYYY-MM-DD) for chart bucketing. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Last N UTC calendar days, oldest first, as YYYY-MM-DD keys. */
export function lastNDayKeys(n: number): string[] {
  const days: string[] = [];
  const now = Date.now();
  for (let i = n - 1; i >= 0; i--) {
    days.push(dayKey(new Date(now - i * 86_400_000)));
  }
  return days;
}
