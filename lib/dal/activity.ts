import "server-only";

import { getSessionUser, requireUser } from "@/lib/auth";
import { err, ok, ApiErrorCode, type ApiResponse } from "@/lib/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { maskSensitive } from "@/lib/mask";
import { listQuerySchema } from "@/lib/validators";
import {
  dbError,
  pageWindow,
  parseOr,
  SETUP_MESSAGE,
} from "./helpers";
import type { ActivityLogRow, PageResult } from "./types";

/**
 * Per-user activity history (brief §07/§08: who/when per change).
 *
 * `logActivity` is best-effort and NEVER throws: a logging failure must not
 * break the mutation it observes. Metadata is masked for secrets and must
 * never contain full config `data` — callers log ids and names only.
 */
export async function logActivity(
  action: string,
  resourceType: string,
  resourceId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const user = await getSessionUser();
    if (!user) return;
    const db = await createServerSupabaseClient();
    if (!db) return;
    // RLS: activity_logs_insert_actor allows actor_id = auth.uid().
    const { error } = await db.from("activity_logs").insert({
      actor_id: user.id,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      metadata: maskSensitive(metadata),
    });
    if (error) {
      console.error("[aidify] logActivity insert failed:", error.message);
    }
  } catch (caught) {
    console.error("[aidify] logActivity failed:", caught);
  }
}

/** Paginated activity history for the signed-in user, newest first. */
export async function listActivity(
  query: unknown,
): Promise<ApiResponse<PageResult<ActivityLogRow>>> {
  const user = await requireUser();
  const parsed = parseOr(listQuerySchema, query);
  if (!parsed.ok) return parsed.error;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const { from, to } = pageWindow(parsed.value.page, parsed.value.pageSize);
  const { data, error, count } = await db
    .from("activity_logs")
    .select("*", { count: "exact" })
    .eq("actor_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) return dbError(error);
  return ok({
    items: (data ?? []) as ActivityLogRow[],
    total: count ?? 0,
    page: parsed.value.page,
    pageSize: parsed.value.pageSize,
  });
}
