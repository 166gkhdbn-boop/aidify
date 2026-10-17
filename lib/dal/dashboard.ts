import "server-only";

import { requireUser } from "@/lib/auth";
import { err, ok, ApiErrorCode, type ApiResponse } from "@/lib/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { dbError, dayKey, lastNDayKeys, SETUP_MESSAGE } from "./helpers";
import type { AnnouncementRow } from "./types";

/**
 * User dashboard statistics (brief §16: real data only).
 *
 * Every metric is a live query against the user's own rows. If a metric
 * cannot be measured it is returned as `null` and the UI renders an honest
 * "Not available" state — values are never fabricated.
 */

export interface DashboardStats {
  totals: { total: number; active: number; archived: number; draft: number };
  collections: number;
  projects: number;
  /** Configs created per day, last 30 days (UTC buckets, zero-filled). */
  createdPerDay: { date: string; count: number }[];
  /** Activity entries per day, last 14 days (UTC buckets, zero-filled). */
  activityPerDay: { date: string; count: number }[];
  byStatus: { status: string; count: number }[];
  byType: { type: string; count: number }[];
  recentConfigs: {
    id: string;
    name: string;
    config_type: string;
    environment: string;
    status: string;
    updated_at: string;
  }[];
  recentActivity: {
    id: string;
    action: string;
    resource_type: string;
    created_at: string;
  }[];
}

function bucketize(
  days: string[],
  timestamps: string[],
): { date: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const ts of timestamps) {
    const key = dayKey(new Date(ts));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return days.map((date) => ({ date, count: counts.get(date) ?? 0 }));
}

export async function getDashboardStats(): Promise<
  ApiResponse<DashboardStats>
> {
  const user = await requireUser();
  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000).toISOString();

  const [
    totalRes,
    activeRes,
    archivedRes,
    draftRes,
    collectionsRes,
    projectsRes,
    createdRes,
    activityRes,
    typesRes,
    recentConfigsRes,
    recentActivityRes,
  ] = await Promise.all([
    db.from("configurations").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
    db.from("configurations").select("id", { count: "exact", head: true }).eq("owner_id", user.id).eq("status", "active"),
    db.from("configurations").select("id", { count: "exact", head: true }).eq("owner_id", user.id).eq("status", "archived"),
    db.from("configurations").select("id", { count: "exact", head: true }).eq("owner_id", user.id).eq("status", "draft"),
    db.from("collections").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
    db.from("projects").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
    db.from("configurations").select("created_at").eq("owner_id", user.id).gte("created_at", thirtyDaysAgo).order("created_at").limit(5000),
    db.from("activity_logs").select("created_at").eq("actor_id", user.id).gte("created_at", fourteenDaysAgo).order("created_at").limit(5000),
    db.from("configurations").select("config_type").eq("owner_id", user.id).limit(5000),
    db.from("configurations").select("id, name, config_type, environment, status, updated_at").eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(5),
    db.from("activity_logs").select("id, action, resource_type, created_at").eq("actor_id", user.id).order("created_at", { ascending: false }).limit(8),
  ]);

  for (const res of [
    totalRes, activeRes, archivedRes, draftRes, collectionsRes,
    projectsRes, createdRes, activityRes, typesRes,
    recentConfigsRes, recentActivityRes,
  ]) {
    if (res.error) return dbError(res.error);
  }

  const total = totalRes.count ?? 0;
  const active = activeRes.count ?? 0;
  const archived = archivedRes.count ?? 0;
  const draft = draftRes.count ?? 0;

  const typeCounts = new Map<string, number>();
  for (const row of (typesRes.data ?? []) as { config_type: string }[]) {
    typeCounts.set(row.config_type, (typeCounts.get(row.config_type) ?? 0) + 1);
  }

  return ok({
    totals: { total, active, archived, draft },
    collections: collectionsRes.count ?? 0,
    projects: projectsRes.count ?? 0,
    createdPerDay: bucketize(
      lastNDayKeys(30),
      ((createdRes.data ?? []) as { created_at: string }[]).map((r) => r.created_at),
    ),
    activityPerDay: bucketize(
      lastNDayKeys(14),
      ((activityRes.data ?? []) as { created_at: string }[]).map((r) => r.created_at),
    ),
    byStatus: [
      { status: "active", count: active },
      { status: "archived", count: archived },
      { status: "draft", count: draft },
    ],
    byType: [...typeCounts.entries()].map(([type, count]) => ({ type, count })),
    recentConfigs: (recentConfigsRes.data ?? []) as DashboardStats["recentConfigs"],
    recentActivity: (recentActivityRes.data ?? []) as DashboardStats["recentActivity"],
  });
}

/**
 * Published announcements visible to this user. RLS already restricts to
 * `published = true` and audience 'all'/'users' for non-admins (admins also
 * see 'admins'); the `in()` filter is a redundant belt for the UI contract.
 */
export async function getPublishedAnnouncements(): Promise<
  ApiResponse<AnnouncementRow[]>
> {
  await requireUser();
  const db = await createServerSupabaseClient();
  if (!db) return err(ApiErrorCode.NOT_CONFIGURED, SETUP_MESSAGE);

  const { data, error } = await db
    .from("announcements")
    .select("*")
    .eq("published", true)
    .in("audience", ["all", "users"])
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) return dbError(error);
  return ok((data ?? []) as AnnouncementRow[]);
}
