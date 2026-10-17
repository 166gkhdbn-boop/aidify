import "server-only";

import { z } from "zod";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { requireRole } from "@/lib/auth";
import { err, ok, ApiErrorCode, type ApiResponse } from "@/lib/api-response";
import { auditLog } from "@/lib/audit";
import {
  logSecurityEvent,
  type SecurityEventType,
} from "@/lib/security-events";
import { getPublicSettings } from "./settings";
import { createNotification } from "./notifications";
import {
  announcementSchema,
  updateAnnouncementSchema,
  ticketReplySchema,
  ticketStatusSchema,
  systemSettingsPatchSchema,
  listQuerySchema,
  uuidSchema,
  type SystemSettingsPatch,
} from "@/lib/validators";
import {
  dbError,
  notFound,
  pageWindow,
  parseOr,
  escapeLike,
  dayKey,
  lastNDayKeys,
  getAdminClient,
} from "./helpers";
import type {
  ActivityLogRow,
  AnnouncementRow,
  PageResult,
  TicketReplyRow,
  TicketRow,
} from "./types";

/**
 * Admin data-access layer (brief §10/§11).
 *
 * Every function starts with `requireRole('administrator')` (or the
 * moderator variant where noted) — authorization is enforced server-side on
 * every call, never trusted from the client. All writes go through the
 * service-role client and are audit-logged. Self-targeting destructive
 * actions (suspend own account, change own roles) are rejected to prevent
 * self-grant / self-escalation.
 */

async function adminGuard(): Promise<User> {
  const { user } = await requireRole("administrator");
  return user;
}

async function moderatorGuard(): Promise<User> {
  const { user } = await requireRole("moderator");
  return user;
}

/* ------------------------------------------------------------------ */
/* Platform overview                                                   */
/* ------------------------------------------------------------------ */

export interface PlatformOverview {
  /** From profiles (created by the signup flow for every registered user). */
  totalUsers: number;
  newUsersPerDay: { date: string; count: number }[];
  /** Distinct users with activity_logs or security_events in the last 30d. */
  activeAccounts: number;
  totalConfigs: number;
  configsPerDay: { date: string; count: number }[];
  failedLogins: { total: number; perDay: { date: string; count: number }[] };
  recentAdminActions: {
    id: string;
    actor_id: string | null;
    action: string;
    target_type: string;
    created_at: string;
  }[];
  /** Honest null: Aidify has no files table; storage is "Not available". */
  storage: null;
}

function bucketize(days: string[], timestamps: string[]) {
  const counts = new Map<string, number>();
  for (const ts of timestamps) {
    const key = dayKey(new Date(ts));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return days.map((date) => ({ date, count: counts.get(date) ?? 0 }));
}

export async function getPlatformOverview(): Promise<
  ApiResponse<PlatformOverview>
> {
  await adminGuard();
  const admin = getAdminClient();
  if ("error" in admin) return admin.error;
  const db = admin.client;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [
    usersRes,
    newUsersRes,
    activityRes,
    secEventsRes,
    configsRes,
    configsTrendRes,
    failedRes,
    auditRes,
  ] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }),
    db.from("profiles").select("created_at").gte("created_at", thirtyDaysAgo).limit(100000),
    db.from("activity_logs").select("actor_id").gte("created_at", thirtyDaysAgo).limit(20000),
    db.from("security_events").select("user_id").gte("created_at", thirtyDaysAgo).not("user_id", "is", null).limit(20000),
    db.from("configurations").select("id", { count: "exact", head: true }),
    db.from("configurations").select("created_at").gte("created_at", thirtyDaysAgo).limit(100000),
    db.from("security_events").select("created_at").ilike("event_type", "login_fail%").gte("created_at", thirtyDaysAgo).limit(20000),
    db.from("audit_logs").select("id, actor_id, action, target_type, created_at").order("created_at", { ascending: false }).limit(10),
  ]);

  for (const res of [usersRes, newUsersRes, activityRes, secEventsRes, configsRes, configsTrendRes, failedRes, auditRes]) {
    if (res.error) return dbError(res.error);
  }

  const activeSet = new Set<string>();
  for (const row of (activityRes.data ?? []) as { actor_id: string }[]) {
    activeSet.add(row.actor_id);
  }
  for (const row of (secEventsRes.data ?? []) as { user_id: string }[]) {
    activeSet.add(row.user_id);
  }

  const days = lastNDayKeys(30);
  return ok({
    totalUsers: usersRes.count ?? 0,
    newUsersPerDay: bucketize(
      days,
      ((newUsersRes.data ?? []) as { created_at: string }[]).map((r) => r.created_at),
    ),
    activeAccounts: activeSet.size,
    totalConfigs: configsRes.count ?? 0,
    configsPerDay: bucketize(
      days,
      ((configsTrendRes.data ?? []) as { created_at: string }[]).map((r) => r.created_at),
    ),
    failedLogins: {
      total: (failedRes.data ?? []).length,
      perDay: bucketize(
        days,
        ((failedRes.data ?? []) as { created_at: string }[]).map((r) => r.created_at),
      ),
    },
    recentAdminActions: (auditRes.data ?? []) as PlatformOverview["recentAdminActions"],
    // Honest: no files table exists, so storage cannot be measured.
    storage: null,
  });
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export interface AdminUserSummary {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  roles: string[];
}

export interface AdminUserDetail extends AdminUserSummary {
  configs: { total: number; active: number; archived: number; draft: number };
  recentActivity: ActivityLogRow[];
  recentSecurityEvents: {
    id: string;
    event_type: string;
    ip: string | null;
    created_at: string;
  }[];
}

/**
 * Raw profile row as returned by the nested `user_roles(roles(name))` select.
 * Supabase's inferred type models the nested `roles` as an array; at runtime
 * it is a single object (many-to-one), so both shapes are accepted.
 */
interface RawUserRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  user_roles:
    | { roles: { name?: unknown } | { name?: unknown }[] | null }[]
    | null;
}

function roleNames(userRoles: RawUserRow["user_roles"]): string[] {
  const names: string[] = [];
  for (const ur of userRoles ?? []) {
    const r = ur.roles;
    const name = Array.isArray(r) ? r[0]?.name : r?.name;
    if (typeof name === "string") names.push(name);
  }
  return names;
}

function toUserSummary(row: RawUserRow): AdminUserSummary {
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    created_at: row.created_at,
    roles: roleNames(row.user_roles),
  };
}

export async function listUsers(
  query: unknown,
): Promise<ApiResponse<PageResult<AdminUserSummary>>> {
  await adminGuard();
  const parsed = parseOr(listQuerySchema, query);
  if (!parsed.ok) return parsed.error;
  const q = parsed.value;

  const admin = getAdminClient();
  if ("error" in admin) return admin.error;

  let builder = admin.client
    .from("profiles")
    .select("id, username, display_name, avatar_url, created_at, user_roles(roles(name))", { count: "exact" });
  if (q.search) {
    const s = escapeLike(q.search);
    builder = builder.or(`username.ilike.%${s}%,display_name.ilike.%${s}%`);
  }
  builder = builder.order("created_at", { ascending: false });

  const { from, to } = pageWindow(q.page, q.pageSize);
  const { data, error, count } = await builder.range(from, to);
  if (error) return dbError(error);

  return ok({
    items: ((data ?? []) as unknown as RawUserRow[]).map(toUserSummary),
    total: count ?? 0,
    page: q.page,
    pageSize: q.pageSize,
  });
}

export async function getUserDetail(
  id: unknown,
): Promise<ApiResponse<AdminUserDetail>> {
  await adminGuard();
  const parsed = parseOr(uuidSchema, id);
  if (!parsed.ok) return parsed.error;

  const admin = getAdminClient();
  if ("error" in admin) return admin.error;
  const db = admin.client;

  const { data: profile, error } = await db
    .from("profiles")
    .select("id, username, display_name, avatar_url, created_at, user_roles(roles(name))")
    .eq("id", parsed.value)
    .maybeSingle();
  if (error) return dbError(error);
  if (!profile) return notFound("User not found.");

  const [totalRes, activeRes, archivedRes, draftRes, activityRes, secRes] =
    await Promise.all([
      db.from("configurations").select("id", { count: "exact", head: true }).eq("owner_id", parsed.value),
      db.from("configurations").select("id", { count: "exact", head: true }).eq("owner_id", parsed.value).eq("status", "active"),
      db.from("configurations").select("id", { count: "exact", head: true }).eq("owner_id", parsed.value).eq("status", "archived"),
      db.from("configurations").select("id", { count: "exact", head: true }).eq("owner_id", parsed.value).eq("status", "draft"),
      db.from("activity_logs").select("*").eq("actor_id", parsed.value).order("created_at", { ascending: false }).limit(10),
      db.from("security_events").select("id, event_type, ip, created_at").eq("user_id", parsed.value).order("created_at", { ascending: false }).limit(10),
    ]);

  return ok({
    ...toUserSummary(profile as unknown as RawUserRow),
    configs: {
      total: totalRes.count ?? 0,
      active: activeRes.count ?? 0,
      archived: archivedRes.count ?? 0,
      draft: draftRes.count ?? 0,
    },
    recentActivity: (activityRes.data ?? []) as ActivityLogRow[],
    recentSecurityEvents: (secRes.data ?? []) as AdminUserDetail["recentSecurityEvents"],
  });
}

const reasonSchema = z.string().trim().max(500).nullable().optional();

/**
 * Suspend an account via the Supabase Admin API (long ban duration).
 * Self-suspension is rejected.
 */
export async function suspendUser(
  id: unknown,
  reason: unknown,
): Promise<ApiResponse<{ suspended: boolean }>> {
  const me = await adminGuard();
  const idParsed = parseOr(uuidSchema, id);
  if (!idParsed.ok) return idParsed.error;
  const reasonParsed = parseOr(reasonSchema, reason);
  if (!reasonParsed.ok) return reasonParsed.error;

  if (idParsed.value === me.id) {
    return err(ApiErrorCode.FORBIDDEN, "You cannot suspend your own account.");
  }

  const admin = getAdminClient();
  if ("error" in admin) return admin.error;

  const { error } = await admin.client.auth.admin.updateUserById(idParsed.value, {
    // ~100 years: effectively indefinite (Supabase has no permanent ban flag).
    ban_duration: "876000h",
  });
  if (error) {
    console.error("[aidify] suspendUser failed:", error.message);
    return err(ApiErrorCode.INTERNAL, "Could not suspend the account.");
  }

  await auditLog("user_suspended", "user", idParsed.value, {
    reason: reasonParsed.value,
    actorId: me.id,
  });
  await logSecurityEvent({
    eventType: "account_suspended" as SecurityEventType,
    userId: idParsed.value,
    metadata: { by: me.id, reason: reasonParsed.value ?? undefined },
  });
  await createNotification(
    idParsed.value,
    "Account suspended",
    reasonParsed.value
      ? `Your account was suspended: ${reasonParsed.value}`
      : "Your account was suspended. Contact support for details.",
  );
  return ok({ suspended: true });
}

/** Lift a suspension (ban_duration "none"). Self-targeting is rejected. */
export async function reactivateUser(
  id: unknown,
): Promise<ApiResponse<{ reactivated: boolean }>> {
  const me = await adminGuard();
  const parsed = parseOr(uuidSchema, id);
  if (!parsed.ok) return parsed.error;

  if (parsed.value === me.id) {
    return err(ApiErrorCode.FORBIDDEN, "You cannot change your own suspension state.");
  }

  const admin = getAdminClient();
  if ("error" in admin) return admin.error;

  const { error } = await admin.client.auth.admin.updateUserById(parsed.value, {
    ban_duration: "none",
  });
  if (error) {
    console.error("[aidify] reactivateUser failed:", error.message);
    return err(ApiErrorCode.INTERNAL, "Could not reactivate the account.");
  }

  await auditLog("user_reactivated", "user", parsed.value, { actorId: me.id });
  await logSecurityEvent({
    eventType: "account_reactivated" as SecurityEventType,
    userId: parsed.value,
    metadata: { by: me.id },
  });
  await createNotification(
    parsed.value,
    "Account reactivated",
    "Your account has been reactivated. You can sign in again.",
  );
  return ok({ reactivated: true });
}

/**
 * Replace a user's role set. Audited. REJECTED when the target is the admin
 * themselves — no self-grant / self-escalation, ever.
 */
export async function setUserRoles(
  userId: unknown,
  roleIds: unknown,
  reason: unknown,
): Promise<ApiResponse<{ roles: string[] }>> {
  const me = await adminGuard();
  const idParsed = parseOr(uuidSchema, userId);
  if (!idParsed.ok) return idParsed.error;
  const rolesParsed = parseOr(z.array(uuidSchema).max(20), roleIds);
  if (!rolesParsed.ok) return rolesParsed.error;
  const reasonParsed = parseOr(reasonSchema, reason);
  if (!reasonParsed.ok) return reasonParsed.error;

  if (idParsed.value === me.id) {
    return err(
      ApiErrorCode.FORBIDDEN,
      "You cannot change your own roles.",
    );
  }

  const admin = getAdminClient();
  if ("error" in admin) return admin.error;
  const db = admin.client;

  // Every role id must reference a real role.
  const { data: roles, error: rolesError } = await db
    .from("roles")
    .select("id, name")
    .in("id", rolesParsed.value.length > 0 ? rolesParsed.value : ["00000000-0000-0000-0000-000000000000"]);
  if (rolesError) return dbError(rolesError);
  const found = new Map(((roles ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name]));
  const unknown = rolesParsed.value.filter((id) => !found.has(id));
  if (unknown.length > 0) {
    return err(ApiErrorCode.VALIDATION, "One or more roles do not exist.");
  }

  const { data: previous } = await db
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", idParsed.value);
  const previousNames = roleNames(
    (previous ?? []) as unknown as RawUserRow["user_roles"],
  );

  const { error: delError } = await db
    .from("user_roles")
    .delete()
    .eq("user_id", idParsed.value);
  if (delError) return dbError(delError);

  if (rolesParsed.value.length > 0) {
    const { error: insError } = await db.from("user_roles").insert(
      rolesParsed.value.map((role_id) => ({
        user_id: idParsed.value,
        role_id,
        assigned_by: me.id,
      })),
    );
    if (insError) return dbError(insError);
  }

  const newNames = rolesParsed.value.map((id) => found.get(id) as string);
  await auditLog("roles_updated", "user", idParsed.value, {
    reason: reasonParsed.value,
    metadata: { previous: previousNames, current: newNames },
    actorId: me.id,
  });
  return ok({ roles: newNames });
}

/**
 * Generate a password-recovery link for the user and return it so the admin
 * can deliver it through their own channel. The email is NOT sent by this
 * function — the caller must not claim otherwise.
 */
export async function initiateRecovery(
  id: unknown,
): Promise<ApiResponse<{ email: string; recoveryLink: string }>> {
  const me = await adminGuard();
  const parsed = parseOr(uuidSchema, id);
  if (!parsed.ok) return parsed.error;

  const admin = getAdminClient();
  if ("error" in admin) return admin.error;

  const { data: userData, error: userError } =
    await admin.client.auth.admin.getUserById(parsed.value);
  if (userError || !userData.user?.email) {
    return notFound("User not found.");
  }

  const { data: linkData, error: linkError } =
    await admin.client.auth.admin.generateLink({
      type: "recovery",
      email: userData.user.email,
    });
  if (linkError || !linkData.properties?.action_link) {
    console.error("[aidify] initiateRecovery failed:", linkError?.message);
    return err(ApiErrorCode.INTERNAL, "Could not generate a recovery link.");
  }

  await auditLog("recovery_initiated", "user", parsed.value, {
    metadata: { email: userData.user.email },
    actorId: me.id,
  });
  return ok({
    email: userData.user.email,
    recoveryLink: linkData.properties.action_link,
  });
}

/* ------------------------------------------------------------------ */
/* Content moderation                                                  */
/* ------------------------------------------------------------------ */

export interface ModeratedConfig {
  id: string;
  name: string;
  owner_id: string;
  owner_username: string | null;
  config_type: string;
  environment: string;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
}

/** All configs with owner info (moderator+). */
export async function moderateConfigs(
  query: unknown,
): Promise<ApiResponse<PageResult<ModeratedConfig>>> {
  await moderatorGuard();
  const parsed = parseOr(listQuerySchema, query);
  if (!parsed.ok) return parsed.error;
  const q = parsed.value;

  const admin = getAdminClient();
  if ("error" in admin) return admin.error;
  const db = admin.client;

  let builder = db
    .from("configurations")
    .select("id, name, owner_id, config_type, environment, status, version, created_at, updated_at", { count: "exact" });
  if (q.search) {
    builder = builder.ilike("name", `%${escapeLike(q.search)}%`);
  }
  builder = builder.order("created_at", { ascending: false });

  const { from, to } = pageWindow(q.page, q.pageSize);
  const { data, error, count } = await builder.range(from, to);
  if (error) return dbError(error);

  const rows = (data ?? []) as Omit<ModeratedConfig, "owner_username">[];
  const ownerIds = [...new Set(rows.map((r) => r.owner_id))];
  const usernames = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data: profiles } = await db
      .from("profiles")
      .select("id, username")
      .in("id", ownerIds);
    for (const p of (profiles ?? []) as { id: string; username: string }[]) {
      usernames.set(p.id, p.username);
    }
  }

  return ok({
    items: rows.map((r) => ({
      ...r,
      owner_username: usernames.get(r.owner_id) ?? null,
    })),
    total: count ?? 0,
    page: q.page,
    pageSize: q.pageSize,
  });
}

async function fetchAnyConfig(db: SupabaseClient, id: string) {
  const { data, error } = await db
    .from("configurations")
    .select("id, owner_id, name")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[aidify] moderation fetch failed:", error.message);
    return null;
  }
  return (data as { id: string; owner_id: string; name: string } | null) ?? null;
}

/** Archive any user's config with a recorded reason (moderator+). */
export async function moderateArchive(
  id: unknown,
  reason: unknown,
): Promise<ApiResponse<{ archived: boolean }>> {
  const me = await moderatorGuard();
  const idParsed = parseOr(uuidSchema, id);
  if (!idParsed.ok) return idParsed.error;
  const reasonParsed = parseOr(
    z.string().trim().min(1, "A reason is required").max(500),
    reason,
  );
  if (!reasonParsed.ok) return reasonParsed.error;

  const admin = getAdminClient();
  if ("error" in admin) return admin.error;

  const target = await fetchAnyConfig(admin.client, idParsed.value);
  if (!target) return notFound("Configuration not found.");

  const { error } = await admin.client
    .from("configurations")
    .update({ status: "archived" })
    .eq("id", idParsed.value);
  if (error) return dbError(error);

  await auditLog("config_moderated_archive", "configuration", idParsed.value, {
    reason: reasonParsed.value,
    metadata: { owner_id: target.owner_id, name: target.name },
    actorId: me.id,
  });
  await createNotification(
    target.owner_id,
    "Configuration archived by moderation",
    `Your configuration "${target.name}" was archived: ${reasonParsed.value}`,
    "/app/configs",
  );
  return ok({ archived: true });
}

/** Hard-delete any user's config with a recorded reason (moderator+). */
export async function moderateDelete(
  id: unknown,
  reason: unknown,
): Promise<ApiResponse<{ deleted: boolean }>> {
  const me = await moderatorGuard();
  const idParsed = parseOr(uuidSchema, id);
  if (!idParsed.ok) return idParsed.error;
  const reasonParsed = parseOr(
    z.string().trim().min(1, "A reason is required").max(500),
    reason,
  );
  if (!reasonParsed.ok) return reasonParsed.error;

  const admin = getAdminClient();
  if ("error" in admin) return admin.error;

  const target = await fetchAnyConfig(admin.client, idParsed.value);
  if (!target) return notFound("Configuration not found.");

  const { error } = await admin.client
    .from("configurations")
    .delete()
    .eq("id", idParsed.value);
  if (error) return dbError(error);

  await auditLog("config_moderated_delete", "configuration", idParsed.value, {
    reason: reasonParsed.value,
    metadata: { owner_id: target.owner_id, name: target.name },
    actorId: me.id,
  });
  await createNotification(
    target.owner_id,
    "Configuration removed by moderation",
    `Your configuration "${target.name}" was removed: ${reasonParsed.value}`,
    "/app/configs",
  );
  return ok({ deleted: true });
}

/* ------------------------------------------------------------------ */
/* Audit logs                                                          */
/* ------------------------------------------------------------------ */

export interface AuditLogFilters {
  action?: string;
  actorId?: string;
}

export async function listAuditLogs(
  filters: unknown,
  query: unknown,
): Promise<
  ApiResponse<
    PageResult<{
      id: string;
      actor_id: string | null;
      action: string;
      target_type: string;
      target_id: string | null;
      reason: string | null;
      created_at: string;
    }>
  >
> {
  await adminGuard();
  const fParsed = parseOr(
    z.object({
      action: z.string().trim().max(120).optional(),
      actorId: uuidSchema.optional(),
    }),
    filters,
  );
  if (!fParsed.ok) return fParsed.error;
  const qParsed = parseOr(listQuerySchema, query);
  if (!qParsed.ok) return qParsed.error;
  const q = qParsed.value;

  const admin = getAdminClient();
  if ("error" in admin) return admin.error;

  let builder = admin.client
    .from("audit_logs")
    .select("id, actor_id, action, target_type, target_id, reason, created_at", {
      count: "exact",
    });
  if (fParsed.value.action) builder = builder.eq("action", fParsed.value.action);
  if (fParsed.value.actorId) builder = builder.eq("actor_id", fParsed.value.actorId);
  if (q.search) {
    const s = escapeLike(q.search);
    builder = builder.or(`action.ilike.%${s}%,target_type.ilike.%${s}%`);
  }
  builder = builder.order("created_at", { ascending: false });

  const { from, to } = pageWindow(q.page, q.pageSize);
  const { data, error, count } = await builder.range(from, to);
  if (error) return dbError(error);

  return ok({
    items: (data ?? []) as {
      id: string;
      actor_id: string | null;
      action: string;
      target_type: string;
      target_id: string | null;
      reason: string | null;
      created_at: string;
    }[],
    total: count ?? 0,
    page: q.page,
    pageSize: q.pageSize,
  });
}

/* ------------------------------------------------------------------ */
/* Announcements                                                       */
/* ------------------------------------------------------------------ */

export async function listAnnouncements(): Promise<
  ApiResponse<AnnouncementRow[]>
> {
  await adminGuard();
  const admin = getAdminClient();
  if ("error" in admin) return admin.error;

  const { data, error } = await admin.client
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return dbError(error);
  return ok((data ?? []) as AnnouncementRow[]);
}

export async function createAnnouncement(
  input: unknown,
): Promise<ApiResponse<AnnouncementRow>> {
  const me = await adminGuard();
  const parsed = parseOr(announcementSchema, input);
  if (!parsed.ok) return parsed.error;

  const admin = getAdminClient();
  if ("error" in admin) return admin.error;

  const { data, error } = await admin.client
    .from("announcements")
    .insert({
      title: parsed.value.title,
      body: parsed.value.body,
      audience: parsed.value.audience,
      published: parsed.value.published,
      created_by: me.id,
    })
    .select("*")
    .single();
  if (error) return dbError(error);

  await auditLog("announcement_created", "announcement", (data as AnnouncementRow).id, {
    metadata: { title: parsed.value.title },
    actorId: me.id,
  });
  return ok(data as AnnouncementRow);
}

export async function updateAnnouncement(
  id: unknown,
  input: unknown,
): Promise<ApiResponse<AnnouncementRow>> {
  const me = await adminGuard();
  const idParsed = parseOr(uuidSchema, id);
  if (!idParsed.ok) return idParsed.error;
  const inParsed = parseOr(updateAnnouncementSchema, input);
  if (!inParsed.ok) return inParsed.error;

  const admin = getAdminClient();
  if ("error" in admin) return admin.error;

  const patch: Record<string, string | boolean> = {};
  const v = inParsed.value;
  if ("title" in v && v.title !== undefined) patch.title = v.title;
  if ("body" in v && v.body !== undefined) patch.body = v.body;
  if ("audience" in v && v.audience !== undefined) patch.audience = v.audience;
  if ("published" in v && v.published !== undefined) patch.published = v.published;

  const { data, error } = await admin.client
    .from("announcements")
    .update(patch)
    .eq("id", idParsed.value)
    .select("*")
    .maybeSingle();
  if (error) return dbError(error);
  if (!data) return notFound("Announcement not found.");

  await auditLog("announcement_updated", "announcement", idParsed.value, {
    actorId: me.id,
  });
  return ok(data as AnnouncementRow);
}

export async function deleteAnnouncement(
  id: unknown,
): Promise<ApiResponse<{ deleted: boolean }>> {
  const me = await adminGuard();
  const parsed = parseOr(uuidSchema, id);
  if (!parsed.ok) return parsed.error;

  const admin = getAdminClient();
  if ("error" in admin) return admin.error;

  const { data, error } = await admin.client
    .from("announcements")
    .delete()
    .eq("id", parsed.value)
    .select("id");
  if (error) return dbError(error);
  if ((data ?? []).length === 0) return notFound("Announcement not found.");

  await auditLog("announcement_deleted", "announcement", parsed.value, {
    actorId: me.id,
  });
  return ok({ deleted: true });
}

/* ------------------------------------------------------------------ */
/* System settings                                                     */
/* ------------------------------------------------------------------ */

export async function getSystemSettings(): Promise<
  ApiResponse<Record<string, unknown>>
> {
  await adminGuard();
  const admin = getAdminClient();
  if ("error" in admin) return admin.error;

  const { data, error } = await admin.client
    .from("system_settings")
    .select("key, value");
  if (error) return dbError(error);

  const settings: Record<string, unknown> = {};
  for (const row of (data ?? []) as { key: string; value: unknown }[]) {
    settings[row.key] = row.value;
  }
  return ok(settings);
}

/** Update whitelisted settings; every key is validated, the change audited. */
export async function updateSystemSettings(
  patch: unknown,
  adminId: unknown,
): Promise<ApiResponse<Record<string, unknown>>> {
  const me = await adminGuard();
  const patchParsed = parseOr(systemSettingsPatchSchema, patch);
  if (!patchParsed.ok) return patchParsed.error;
  const idParsed = parseOr(uuidSchema, adminId);
  if (!idParsed.ok) return idParsed.error;

  if (idParsed.value !== me.id) {
    return err(ApiErrorCode.FORBIDDEN, "Admin identity mismatch.");
  }

  const admin = getAdminClient();
  if ("error" in admin) return admin.error;

  const entries = Object.entries(patchParsed.value) as [string, SystemSettingsPatch[keyof SystemSettingsPatch]][];
  if (entries.length === 0) {
    return err(ApiErrorCode.VALIDATION, "Nothing to update.");
  }

  for (const [key, value] of entries) {
    const { error } = await admin.client.from("system_settings").upsert(
      { key, value, updated_by: me.id },
      { onConflict: "key" },
    );
    if (error) return dbError(error);
  }

  await auditLog("settings_updated", "system_settings", null, {
    metadata: { keys: entries.map(([k]) => k) },
    actorId: me.id,
  });
  const current = await getSystemSettings();
  return current;
}

/* ------------------------------------------------------------------ */
/* Support queue (staff side)                                          */
/* ------------------------------------------------------------------ */

export interface AdminTicketSummary extends TicketRow {
  username: string | null;
  reply_count: number;
}

export async function listSupportTickets(
  status: unknown,
  query: unknown,
): Promise<ApiResponse<PageResult<AdminTicketSummary>>> {
  await moderatorGuard();
  const statusParsed = parseOr(ticketStatusSchema.nullable().optional(), status);
  if (!statusParsed.ok) return statusParsed.error;
  const qParsed = parseOr(listQuerySchema, query);
  if (!qParsed.ok) return qParsed.error;
  const q = qParsed.value;

  const admin = getAdminClient();
  if ("error" in admin) return admin.error;
  const db = admin.client;

  let builder = db
    .from("support_tickets")
    .select("*", { count: "exact" });
  if (statusParsed.value) builder = builder.eq("status", statusParsed.value);
  if (q.search) {
    const s = escapeLike(q.search);
    builder = builder.or(`subject.ilike.%${s}%,description.ilike.%${s}%`);
  }
  builder = builder.order("updated_at", { ascending: false });

  const { from, to } = pageWindow(q.page, q.pageSize);
  const { data, error, count } = await builder.range(from, to);
  if (error) return dbError(error);

  const rows = (data ?? []) as TicketRow[];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const usernames = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await db
      .from("profiles")
      .select("id, username")
      .in("id", userIds);
    for (const p of (profiles ?? []) as { id: string; username: string }[]) {
      usernames.set(p.id, p.username);
    }
  }
  const replyCounts = new Map<string, number>();
  if (rows.length > 0) {
    const { data: replies } = await db
      .from("support_ticket_replies")
      .select("ticket_id")
      .in("ticket_id", rows.map((r) => r.id))
      .limit(5000);
    for (const r of (replies ?? []) as { ticket_id: string }[]) {
      replyCounts.set(r.ticket_id, (replyCounts.get(r.ticket_id) ?? 0) + 1);
    }
  }

  return ok({
    items: rows.map((r) => ({
      ...r,
      username: usernames.get(r.user_id) ?? null,
      reply_count: replyCounts.get(r.id) ?? 0,
    })),
    total: count ?? 0,
    page: q.page,
    pageSize: q.pageSize,
  });
}

/** Staff reply: is_staff=true, ticket moves open → in_progress, user notified. */
export async function replyToTicketAdmin(
  ticketId: unknown,
  body: unknown,
): Promise<ApiResponse<TicketReplyRow>> {
  const me = await moderatorGuard();
  const idParsed = parseOr(uuidSchema, ticketId);
  if (!idParsed.ok) return idParsed.error;
  const bodyParsed = parseOr(ticketReplySchema, { body });
  if (!bodyParsed.ok) return bodyParsed.error;

  const admin = getAdminClient();
  if ("error" in admin) return admin.error;
  const db = admin.client;

  const { data: ticket, error: tError } = await db
    .from("support_tickets")
    .select("*")
    .eq("id", idParsed.value)
    .maybeSingle();
  if (tError) return dbError(tError);
  if (!ticket) return notFound("Ticket not found.");
  const ticketRow = ticket as TicketRow;

  const { data, error } = await db
    .from("support_ticket_replies")
    .insert({
      ticket_id: idParsed.value,
      author_id: me.id,
      body: bodyParsed.value.body,
      is_staff: true,
    })
    .select("*")
    .single();
  if (error) return dbError(error);

  if (ticketRow.status === "open") {
    await db
      .from("support_tickets")
      .update({ status: "in_progress" })
      .eq("id", idParsed.value);
  }

  await auditLog("ticket_replied", "support_ticket", idParsed.value, {
    metadata: { subject: ticketRow.subject },
    actorId: me.id,
  });
  await createNotification(
    ticketRow.user_id,
    "Support replied to your ticket",
    `Support replied to "${ticketRow.subject}".`,
    "/app/support",
  );
  return ok(data as TicketReplyRow);
}

export async function setTicketStatus(
  ticketId: unknown,
  status: unknown,
): Promise<ApiResponse<TicketRow>> {
  const me = await moderatorGuard();
  const idParsed = parseOr(uuidSchema, ticketId);
  if (!idParsed.ok) return idParsed.error;
  const statusParsed = parseOr(ticketStatusSchema, status);
  if (!statusParsed.ok) return statusParsed.error;

  const admin = getAdminClient();
  if ("error" in admin) return admin.error;

  const { data, error } = await admin.client
    .from("support_tickets")
    .update({ status: statusParsed.value })
    .eq("id", idParsed.value)
    .select("*")
    .maybeSingle();
  if (error) return dbError(error);
  if (!data) return notFound("Ticket not found.");

  await auditLog("ticket_status_changed", "support_ticket", idParsed.value, {
    metadata: { status: statusParsed.value },
    actorId: me.id,
  });
  return ok(data as TicketRow);
}

/* ------------------------------------------------------------------ */
/* System health                                                       */
/* ------------------------------------------------------------------ */

export interface SystemHealth {
  database: { ok: boolean; latencyMs: number; message: string };
  auth: { ok: boolean; message: string };
  recentErrors: { id: string; message: string; created_at: string }[];
  warnings: { level: "warning" | "info"; message: string }[];
}

/** Live health probes + operational warnings derived from real state. */
export async function getSystemHealth(): Promise<ApiResponse<SystemHealth>> {
  await adminGuard();
  const admin = getAdminClient();
  if ("error" in admin) return admin.error;
  const db = admin.client;

  const t0 = Date.now();
  const { error: dbErrorRaw } = await db
    .from("system_settings")
    .select("key")
    .limit(1);
  const latencyMs = Date.now() - t0;

  const { error: authError } = await db.auth.admin.listUsers({
    page: 1,
    perPage: 1,
  });

  const { data: errors } = await db
    .from("app_errors")
    .select("id, message, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  const settings = await getPublicSettings();
  const warnings: SystemHealth["warnings"] = [];
  if (settings.maintenance_mode) {
    warnings.push({
      level: "warning",
      message: "Maintenance mode is ON — non-admin users are blocked.",
    });
  }
  if (!settings.registration_open) {
    warnings.push({ level: "info", message: "Registration is closed." });
  }

  return ok({
    database: {
      ok: !dbErrorRaw,
      latencyMs,
      message: dbErrorRaw
        ? `Database probe failed: ${dbErrorRaw.message}`
        : `Database reachable (${latencyMs} ms).`,
    },
    auth: {
      ok: !authError,
      message: authError
        ? `Auth service probe failed: ${authError.message}`
        : "Auth service reachable.",
    },
    recentErrors: (errors ?? []) as SystemHealth["recentErrors"],
    warnings,
  });
}
