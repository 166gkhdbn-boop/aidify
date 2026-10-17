import "server-only";

import { requireUser } from "@/lib/auth";
import { err, ok, ApiErrorCode, type ApiResponse } from "@/lib/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { dateRangeSchema } from "@/lib/validators";
import { dbError, dayKey, parseOr, SETUP_MESSAGE } from "./helpers";

/**
 * Analytics aggregations (brief §16: real data only, date-range filtered).
 *
 * Empty result sets produce empty arrays — the UI renders graceful empty
 * states. All buckets use UTC calendar days.
 */

export interface ConfigAnalytics {
  perDay: { date: string; count: number }[];
  byStatus: { status: string; count: number }[];
  byType: { type: string; count: number }[];
  byEnvironment: { environment: string; count: number }[];
}

export interface ActivityAnalytics {
  perDay: { date: string; count: number }[];
  byAction: { action: string; count: number }[];
}

/** All UTC day keys between two ISO timestamps, inclusive. */
function dayRangeKeys(fromIso: string, toIso: string): string[] {
  const keys: string[] = [];
  const cursor = new Date(fromIso);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(toIso);
  end.setUTCHours(0, 0, 0, 0);
  while (cursor <= end && keys.length <= 367) {
    keys.push(dayKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

export async function getConfigAnalytics(
  range: unknown,
): Promise<ApiResponse<ConfigAnalytics>> {
  const user = await requireUser();
  const parsed = parseOr(dateRangeSchema, range);
  if (!parsed.ok) return parsed.error;
  const { from, to } = parsed.value;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const { data, error } = await db
    .from("configurations")
    .select("created_at, status, config_type, environment")
    .eq("owner_id", user.id)
    .gte("created_at", from)
    .lte("created_at", to)
    .order("created_at")
    .limit(5000);
  if (error) return dbError(error);

  const rows = (data ?? []) as {
    created_at: string;
    status: string;
    config_type: string;
    environment: string;
  }[];

  const days = dayRangeKeys(from, to);
  const perDayCounts = new Map<string, number>();
  const byStatus = new Map<string, number>();
  const byType = new Map<string, number>();
  const byEnvironment = new Map<string, number>();
  for (const row of rows) {
    const key = dayKey(new Date(row.created_at));
    perDayCounts.set(key, (perDayCounts.get(key) ?? 0) + 1);
    byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1);
    byType.set(row.config_type, (byType.get(row.config_type) ?? 0) + 1);
    byEnvironment.set(row.environment, (byEnvironment.get(row.environment) ?? 0) + 1);
  }

  const counted = (m: Map<string, number>) =>
    [...m.entries()].map(([key, count]) => ({ key, count }));

  return ok({
    perDay: days.map((date) => ({ date, count: perDayCounts.get(date) ?? 0 })),
    byStatus: counted(byStatus).map((e) => ({ status: e.key, count: e.count })),
    byType: counted(byType).map((e) => ({ type: e.key, count: e.count })),
    byEnvironment: counted(byEnvironment).map((e) => ({
      environment: e.key,
      count: e.count,
    })),
  });
}

export async function getActivityAnalytics(
  range: unknown,
): Promise<ApiResponse<ActivityAnalytics>> {
  const user = await requireUser();
  const parsed = parseOr(dateRangeSchema, range);
  if (!parsed.ok) return parsed.error;
  const { from, to } = parsed.value;

  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const { data, error } = await db
    .from("activity_logs")
    .select("created_at, action")
    .eq("actor_id", user.id)
    .gte("created_at", from)
    .lte("created_at", to)
    .order("created_at")
    .limit(5000);
  if (error) return dbError(error);

  const rows = (data ?? []) as { created_at: string; action: string }[];
  const days = dayRangeKeys(from, to);
  const perDayCounts = new Map<string, number>();
  const byAction = new Map<string, number>();
  for (const row of rows) {
    const key = dayKey(new Date(row.created_at));
    perDayCounts.set(key, (perDayCounts.get(key) ?? 0) + 1);
    byAction.set(row.action, (byAction.get(row.action) ?? 0) + 1);
  }

  return ok({
    perDay: days.map((date) => ({ date, count: perDayCounts.get(date) ?? 0 })),
    byAction: [...byAction.entries()].map(([action, count]) => ({
      action,
      count,
    })),
  });
}
