import "server-only";

import { requireUser } from "@/lib/auth";
import { err, ok, ApiErrorCode, type ApiResponse } from "@/lib/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  profileUpdateSchema,
  userPreferencesSchema,
  userPreferencesPatchSchema,
  type ProfileUpdateInput,
  type UserPreferences,
  type UserPreferencesPatch,
} from "@/lib/validators";
import { auditLog } from "@/lib/audit";
import {
  logSecurityEvent,
  type SecurityEventType,
} from "@/lib/security-events";
import { logActivity } from "./activity";
import {
  dbError,
  notFound,
  pageWindow,
  parseOr,
  getAdminClient,
  SETUP_MESSAGE,
} from "./helpers";
import { listQuerySchema } from "@/lib/validators";
import type { PageResult, ProfileRow } from "./types";

/**
 * Profile data-access layer (brief §05: profile, account deletion workflow).
 *
 * `deleteAccount` performs a real, ordered wipe: every user-owned row is
 * removed via the service-role client first (so no orphans survive if the
 * auth deletion were to fail), then the auth user itself is deleted via the
 * Admin API — which cascades the remaining FK references
 * (activity_logs.actor_id, security_events.user_id are SET NULL; the profile
 * row is deleted explicitly here). The action is audit-logged BEFORE the
 * wipe (the actor row disappears with the user).
 */

export async function getProfile(): Promise<ApiResponse<ProfileRow>> {
  const user = await requireUser();
  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const { data, error } = await db
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return dbError(error);
  if (!data) return notFound("Profile not found.");
  return ok(data as ProfileRow);
}

export async function updateProfile(
  input: ProfileUpdateInput,
): Promise<ApiResponse<ProfileRow>> {
  const user = await requireUser();
  const parsed = parseOr(profileUpdateSchema, input);
  if (!parsed.ok) return parsed.error;
  const v = parsed.value;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const patch: Record<string, string | null> = {};
  if ("display_name" in v) patch.display_name = v.display_name ?? null;
  if ("username" in v && v.username !== undefined) patch.username = v.username;
  if ("avatar_url" in v) patch.avatar_url = v.avatar_url ?? null;

  if (Object.keys(patch).length === 0) {
    return err(ApiErrorCode.VALIDATION, "Nothing to update.");
  }

  const { data, error } = await db
    .from("profiles")
    .update(patch)
    .eq("id", user.id)
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") {
      return err(ApiErrorCode.CONFLICT, "This username is already taken.");
    }
    return dbError(error);
  }

  const updated = data as ProfileRow;
  await logActivity("profile_updated", "profile", user.id, {});
  return ok(updated);
}

/**
 * Permanently delete the account and all of its data. Order matters:
 * configs (versions + tag assignments cascade) → collections → projects →
 * tags → notifications → tickets (replies cascade) → role grants → profile →
 * auth user. Returns ok only when the auth user is gone.
 */
export async function deleteAccount(): Promise<
  ApiResponse<{ deleted: boolean }>
> {
  const user = await requireUser();
  const admin = getAdminClient();
  if ("error" in admin) return admin.error;

  const email = user.email ?? "unknown";

  // Audit BEFORE the wipe: the actor id is SET NULL by the FK afterwards,
  // so the username is preserved in metadata.
  await auditLog("account_deleted", "user", user.id, {
    reason: "User-requested account deletion",
    metadata: { username: email },
  });

  const steps: { table: string; column: string }[] = [
    { table: "configurations", column: "owner_id" },
    { table: "collections", column: "owner_id" },
    { table: "projects", column: "owner_id" },
    { table: "configuration_tags", column: "owner_id" },
    { table: "notifications", column: "user_id" },
    { table: "support_tickets", column: "user_id" },
    { table: "user_roles", column: "user_id" },
    { table: "profiles", column: "id" },
  ];
  for (const step of steps) {
    const { error } = await admin.client
      .from(step.table)
      .delete()
      .eq(step.column, user.id);
    if (error) {
      console.error(`[aidify] deleteAccount: ${step.table} wipe failed:`, error.message);
      return err(
        ApiErrorCode.INTERNAL,
        "Could not delete the account. Please try again later.",
      );
    }
  }

  const { error: authError } = await admin.client.auth.admin.deleteUser(user.id);
  if (authError) {
    console.error("[aidify] deleteAccount: auth user deletion failed:", authError.message);
    return err(
      ApiErrorCode.INTERNAL,
      "Could not delete the account. Please try again later.",
    );
  }

  // The account_deleted event type is not in the auth-owned enum (kept
  // untouched to avoid clashing with the Auth agent's parallel work), so
  // the value is cast at the boundary.
  await logSecurityEvent({
    eventType: "account_deleted" as SecurityEventType,
    userId: null,
    metadata: { email },
  });

  return ok({ deleted: true });
}
/* ------------------------------------------------------------------ */
/* User preferences (profiles.preferences JSONB, migration 0005)       */
/* ------------------------------------------------------------------ */

export type { UserPreferences, UserPreferencesPatch };

/** Read the signed-in user's preferences (defaults when unset/corrupt). */
export async function getPreferences(): Promise<ApiResponse<UserPreferences>> {
  const user = await requireUser();
  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const { data, error } = await db
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return dbError(error);

  const raw = (data as { preferences?: unknown } | null)?.preferences ?? {};
  const parsed = userPreferencesSchema.safeParse(raw);
  if (parsed.success) return ok(parsed.data);
  // Corrupted row: never break the settings page — fall back to defaults.
  return ok(userPreferencesSchema.parse({}));
}

/**
 * Patch the signed-in user's preferences. The patch is merged over the
 * current row, the merged value is validated against the full schema, then
 * written back — unknown keys are rejected (`.strict()`).
 */
export async function updatePreferences(
  patch: UserPreferencesPatch,
): Promise<ApiResponse<UserPreferences>> {
  const user = await requireUser();
  const patchParsed = parseOr(userPreferencesPatchSchema, patch);
  if (!patchParsed.ok) return patchParsed.error;

  const current = await getPreferences();
  if (!current.ok) return current;

  const merged = userPreferencesSchema.parse({
    ...current.data,
    ...patchParsed.value,
  });

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const { error } = await db
    .from("profiles")
    .update({ preferences: merged })
    .eq("id", user.id);
  if (error) return dbError(error);

  return ok(merged);
}

/* ------------------------------------------------------------------ */
/* Security event history (user reads own rows — RLS enforced)         */
/* ------------------------------------------------------------------ */

export interface SecurityEventRow {
  id: string;
  user_id: string | null;
  event_type: string;
  ip: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Paginated security-event history for the signed-in user, newest first. */
export async function listMySecurityEvents(
  query: unknown,
): Promise<ApiResponse<PageResult<SecurityEventRow>>> {
  const user = await requireUser();
  const parsed = parseOr(listQuerySchema, query);
  if (!parsed.ok) return parsed.error;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const { from, to } = pageWindow(parsed.value.page, parsed.value.pageSize);
  const { data, error, count } = await db
    .from("security_events")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) return dbError(error);

  return ok({
    items: (data ?? []) as SecurityEventRow[],
    total: count ?? 0,
    page: parsed.value.page,
    pageSize: parsed.value.pageSize,
  });
}
