import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/auth";
import { ok, type ApiResponse } from "@/lib/api-response";
import { auditLog } from "@/lib/audit";
import { maskSensitive } from "@/lib/mask";
import { createNotification } from "@/lib/dal/notifications";
import {
  dbError,
  notFound,
  pageWindow,
  parseOr,
  escapeLike,
  dayKey,
  getAdminClient,
} from "@/lib/dal/helpers";
import { listQuerySchema, uuidSchema } from "@/lib/validators";
import type { PageResult } from "@/lib/dal/types";

/**
 * Admin page queries (reads + the few mutations the admin DAL lacks).
 *
 * NOTE: this module deliberately does NOT live in lib/dal/ — the shared DAL
 * must not be modified by the admin lane. It follows the exact same
 * conventions instead: every function starts with requireRole() (admin or
 * moderator), all reads go through the service-role client, every mutation
 * is audit-logged, and results use the ApiResponse envelope.
 */

async function adminGuard() {
  const { user } = await requireRole("administrator");
  return user;
}

async function moderatorGuard() {
  const { user } = await requireRole("moderator");
  return user;
}

/* ------------------------------------------------------------------ */
/* Roles                                                               */
/* ------------------------------------------------------------------ */

export interface RoleRow {
  id: string;
  name: string;
  description: string | null;
}

export interface RoleWithMembers extends RoleRow {
  memberCount: number;
  members: { id: string; username: string; display_name: string | null }[];
}

export async function listRoles(): Promise<ApiResponse<RoleRow[]>> {
  await adminGuard();
  const admin = getAdminClient();
  if ("error" in admin) return admin.error;

  const { data, error } = await admin.client
    .from("roles")
    .select("id, name, description")
    .order("name", { ascending: true });
  if (error) return dbError(error);
  return ok((data ?? []) as RoleRow[]);
}

export async function listRolesWithMembers(): Promise<
  ApiResponse<RoleWithMembers[]>
> {
  await adminGuard();
  const admin = getAdminClient();
  if ("error" in admin) return admin.error;
  const db = admin.client;

  const [{ data: roles, error: rolesError }, { data: assignments, error: aError }] =
    await Promise.all([
      db.from("roles").select("id, name, description").order("name", { ascending: true }),
      db.from("user_roles").select("user_id, role_id").limit(100000),
    ]);
  if (rolesError) return dbError(rolesError);
  if (aError) return dbError(aError);

  const roleRows = (roles ?? []) as RoleRow[];
  const byRole = new Map<string, string[]>();
  for (const a of (assignments ?? []) as { user_id: string; role_id: string }[]) {
    const list = byRole.get(a.role_id) ?? [];
    list.push(a.user_id);
    byRole.set(a.role_id, list);
  }

  const userIds = [...new Set((assignments ?? []).map((a: { user_id: string }) => a.user_id))];
  const profiles = new Map<string, { username: string; display_name: string | null }>();
  if (userIds.length > 0) {
    const { data: profs } = await db
      .from("profiles")
      .select("id, username, display_name")
      .in("id", userIds);
    for (const p of (profs ?? []) as { id: string; username: string; display_name: string | null }[]) {
      profiles.set(p.id, { username: p.username, display_name: p.display_name });
    }
  }

  return ok(
    roleRows.map((role) => {
      const memberIds = byRole.get(role.id) ?? [];
      return {
        ...role,
        memberCount: memberIds.length,
        members: memberIds.map((id) => ({
          id,
          username: profiles.get(id)?.username ?? "unknown",
          display_name: profiles.get(id)?.display_name ?? null,
        })),
      };
    }),
  );
}

/* ------------------------------------------------------------------ */
/* Permission matrix (read-only — the DAL seeds role_permissions; it   */
/* exposes no grant/revoke API, so the matrix is displayed, not edited)*/
/* ------------------------------------------------------------------ */

export interface PermissionMatrix {
  roles: RoleRow[];
  permissions: { id: string; name: string; description: string | null }[];
  /** role_id -> permission names granted */
  grants: Record<string, string[]>;
}

export async function getPermissionMatrix(): Promise<ApiResponse<PermissionMatrix>> {
  await adminGuard();
  const admin = getAdminClient();
  if ("error" in admin) return admin.error;
  const db = admin.client;

  const [rolesRes, permsRes, grantsRes] = await Promise.all([
    db.from("roles").select("id, name, description").order("name", { ascending: true }),
    db.from("permissions").select("id, name, description").order("name", { ascending: true }),
    db.from("role_permissions").select("role_id, permission_id").limit(100000),
  ]);
  if (rolesRes.error) return dbError(rolesRes.error);
  if (permsRes.error) return dbError(permsRes.error);
  if (grantsRes.error) return dbError(grantsRes.error);

  const permissions = (permsRes.data ?? []) as PermissionMatrix["permissions"];
  const permName = new Map(permissions.map((p) => [p.id, p.name]));
  const grants: Record<string, string[]> = {};
  for (const g of (grantsRes.data ?? []) as { role_id: string; permission_id: string }[]) {
    const name = permName.get(g.permission_id);
    if (!name) continue;
    const list = grants[g.role_id] ?? [];
    list.push(name);
    grants[g.role_id] = list;
  }

  return ok({
    roles: (rolesRes.data ?? []) as RoleRow[],
    permissions,
    grants,
  });
}

/* ------------------------------------------------------------------ */
/* Users (with role + suspended filters the DAL listUsers lacks)       */
/* ------------------------------------------------------------------ */

export interface AdminUserRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  roles: string[];
  email: string | null;
  suspended: boolean;
}

export const usersFilterSchema = z.object({
  role: z.string().trim().min(1).max(64).optional(),
  suspended: z.enum(["all", "suspended", "active"]).default("all"),
});

export type UsersFilter = z.infer<typeof usersFilterSchema>;

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

/** Suspended account ids from the Auth Admin API (emails live there too). */
async function getSuspendedUserIds(db: SupabaseClient): Promise<Set<string>> {
  const ids = new Set<string>();
  const now = Date.now();
  try {
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) {
        console.error("[aidify] listUsers for suspension check failed:", error.message);
        break;
      }
      const users = data?.users ?? [];
      for (const u of users) {
        if (u.banned_until && new Date(u.banned_until).getTime() > now) ids.add(u.id);
      }
      if (users.length < 1000) break;
    }
  } catch (caught) {
    console.error("[aidify] suspension scan failed:", caught);
  }
  return ids;
}

export async function listUsersAdmin(
  filters: unknown,
  query: unknown,
): Promise<ApiResponse<PageResult<AdminUserRow>>> {
  await adminGuard();
  const fParsed = parseOr(usersFilterSchema, filters);
  if (!fParsed.ok) return fParsed.error;
  const qParsed = parseOr(listQuerySchema, query);
  if (!qParsed.ok) return qParsed.error;
  const f = fParsed.value;
  const q = qParsed.value;

  const admin = getAdminClient();
  if ("error" in admin) return admin.error;
  const db = admin.client;

  // Role + suspended filters are resolved to id scopes first (two-step,
  // stays server-side). Suspension lives in auth.users (banned_until).
  let idScope: string[] | null = null;
  let excludeIds: Set<string> | null = null;
  if (f.role || f.suspended !== "all") {
    let roleIds: string[] | null = null;
    if (f.role) {
      const { data, error } = await db
        .from("user_roles")
        .select("user_id, roles!inner(name)")
        .eq("roles.name", f.role)
        .limit(100000);
      if (error) return dbError(error);
      roleIds = [...new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id))];
    }
    let suspendedIds: Set<string> | null = null;
    if (f.suspended !== "all") suspendedIds = await getSuspendedUserIds(db);

    const base = roleIds ?? (suspendedIds ? [...suspendedIds] : null);
    if (f.suspended === "suspended") {
      const scoped = base
        ? base.filter((id) => suspendedIds!.has(id))
        : [];
      if (scoped.length === 0) {
        return ok({ items: [], total: 0, page: q.page, pageSize: q.pageSize });
      }
      idScope = scoped;
    } else if (f.suspended === "active") {
      if (roleIds) {
        idScope = roleIds.filter((id) => !suspendedIds!.has(id));
        if (idScope.length === 0) {
          return ok({ items: [], total: 0, page: q.page, pageSize: q.pageSize });
        }
      } else if (suspendedIds && suspendedIds.size > 0) {
        excludeIds = suspendedIds;
      }
    } else if (roleIds) {
      if (roleIds.length === 0) {
        return ok({ items: [], total: 0, page: q.page, pageSize: q.pageSize });
      }
      idScope = roleIds;
    }
  }

  let builder = db
    .from("profiles")
    .select(
      "id, username, display_name, avatar_url, created_at, user_roles(roles(name))",
      { count: "exact" },
    );
  if (idScope) builder = builder.in("id", idScope);
  else if (excludeIds) builder = builder.not("id", "in", `(${[...excludeIds].join(",")})`);
  if (q.search) {
    const s = escapeLike(q.search);
    builder = builder.or(`username.ilike.%${s}%,display_name.ilike.%${s}%`);
  }
  builder = builder.order("created_at", { ascending: false });

  const { from, to } = pageWindow(q.page, q.pageSize);
  const { data, error, count } = await builder.range(from, to);
  if (error) return dbError(error);

  const rows = (data ?? []) as unknown as RawUserRow[];

  // Email + suspension state come from the Auth Admin API (per-row).
  const enriched = await Promise.all(
    rows.map(async (row): Promise<AdminUserRow> => {
      let email: string | null = null;
      let suspended = false;
      try {
        const { data: uData } = await db.auth.admin.getUserById(row.id);
        email = uData?.user?.email ?? null;
        suspended =
          !!uData?.user?.banned_until &&
          new Date(uData.user.banned_until).getTime() > Date.now();
      } catch {
        /* leave defaults */
      }
      return {
        id: row.id,
        username: row.username,
        display_name: row.display_name,
        avatar_url: row.avatar_url,
        created_at: row.created_at,
        roles: roleNames(row.user_roles),
        email,
        suspended,
      };
    }),
  );

  return ok({
    items: enriched,
    total: count ?? 0,
    page: q.page,
    pageSize: q.pageSize,
  });
}

/** Email + suspension state for the user detail page. */
export async function getUserSuspension(
  id: unknown,
): Promise<ApiResponse<{ email: string | null; suspended: boolean; bannedUntil: string | null }>> {
  await adminGuard();
  const parsed = parseOr(uuidSchema, id);
  if (!parsed.ok) return parsed.error;

  const admin = getAdminClient();
  if ("error" in admin) return admin.error;

  const { data, error } = await admin.client.auth.admin.getUserById(parsed.value);
  if (error || !data?.user) return notFound("User not found.");
  const bannedUntil = data.user.banned_until ?? null;
  return ok({
    email: data.user.email ?? null,
    suspended: !!bannedUntil && new Date(bannedUntil).getTime() > Date.now(),
    bannedUntil,
  });
}

/* ------------------------------------------------------------------ */
/* Collections (platform-wide)                                         */
/* ------------------------------------------------------------------ */

export interface AdminCollectionRow {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  owner_id: string;
  owner_username: string | null;
  config_count: number;
}

export async function listCollectionsAdmin(
  query: unknown,
): Promise<ApiResponse<PageResult<AdminCollectionRow>>> {
  await adminGuard();
  const qParsed = parseOr(listQuerySchema, query);
  if (!qParsed.ok) return qParsed.error;
  const q = qParsed.value;

  const admin = getAdminClient();
  if ("error" in admin) return admin.error;
  const db = admin.client;

  let builder = db.from("collections").select("*", { count: "exact" });
  if (q.search) builder = builder.ilike("name", `%${escapeLike(q.search)}%`);
  builder = builder.order("created_at", { ascending: false });

  const { from, to } = pageWindow(q.page, q.pageSize);
  const { data, error, count } = await builder.range(from, to);
  if (error) return dbError(error);

  const rows = (data ?? []) as (AdminCollectionRow & { owner_id: string })[];
  const ownerIds = [...new Set(rows.map((r) => r.owner_id))];
  const collectionIds = rows.map((r) => r.id);

  const [profilesRes, configsRes] = await Promise.all([
    ownerIds.length > 0
      ? db.from("profiles").select("id, username").in("id", ownerIds)
      : Promise.resolve({ data: [] as { id: string; username: string }[] }),
    collectionIds.length > 0
      ? db.from("configurations").select("collection_id").in("collection_id", collectionIds).limit(50000)
      : Promise.resolve({ data: [] as { collection_id: string | null }[] }),
  ]);

  const usernames = new Map<string, string>();
  for (const p of (profilesRes.data ?? []) as { id: string; username: string }[]) {
    usernames.set(p.id, p.username);
  }
  const counts = new Map<string, number>();
  for (const c of (configsRes.data ?? []) as { collection_id: string | null }[]) {
    if (!c.collection_id) continue;
    counts.set(c.collection_id, (counts.get(c.collection_id) ?? 0) + 1);
  }

  return ok({
    items: rows.map((r) => ({
      ...r,
      owner_username: usernames.get(r.owner_id) ?? null,
      config_count: counts.get(r.id) ?? 0,
    })),
    total: count ?? 0,
    page: q.page,
    pageSize: q.pageSize,
  });
}

export interface AdminCollectionDetail extends AdminCollectionRow {
  configs: {
    id: string;
    name: string;
    config_type: string;
    environment: string;
    status: string;
    version: number;
    updated_at: string;
  }[];
}

export async function getCollectionAdminDetail(
  id: unknown,
): Promise<ApiResponse<AdminCollectionDetail>> {
  await adminGuard();
  const parsed = parseOr(uuidSchema, id);
  if (!parsed.ok) return parsed.error;

  const admin = getAdminClient();
  if ("error" in admin) return admin.error;
  const db = admin.client;

  const { data: collection, error } = await db
    .from("collections")
    .select("*")
    .eq("id", parsed.value)
    .maybeSingle();
  if (error) return dbError(error);
  if (!collection) return notFound("Collection not found.");

  const row = collection as AdminCollectionRow & { owner_id: string };
  const [{ data: profile }, { data: configs }] = await Promise.all([
    db.from("profiles").select("username").eq("id", row.owner_id).maybeSingle(),
    db
      .from("configurations")
      .select("id, name, config_type, environment, status, version, updated_at")
      .eq("collection_id", parsed.value)
      .order("updated_at", { ascending: false })
      .limit(200),
  ]);

  return ok({
    ...row,
    owner_username: (profile as { username: string } | null)?.username ?? null,
    config_count: (configs ?? []).length,
    configs: (configs ?? []) as AdminCollectionDetail["configs"],
  });
}

/* ------------------------------------------------------------------ */
/* Config detail + restore (moderator+)                                */
/* ------------------------------------------------------------------ */

export interface AdminConfigDetail {
  id: string;
  name: string;
  description: string | null;
  config_type: string;
  environment: string;
  status: string;
  version: number;
  notes: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  owner_id: string;
  owner_username: string | null;
  /** Secret values redacted server-side before display. */
  data: Record<string, unknown>;
  version_count: number;
}

export async function getConfigAdminDetail(
  id: unknown,
): Promise<ApiResponse<AdminConfigDetail>> {
  await moderatorGuard();
  const parsed = parseOr(uuidSchema, id);
  if (!parsed.ok) return parsed.error;

  const admin = getAdminClient();
  if ("error" in admin) return admin.error;
  const db = admin.client;

  const { data: config, error } = await db
    .from("configurations")
    .select("*")
    .eq("id", parsed.value)
    .maybeSingle();
  if (error) return dbError(error);
  if (!config) return notFound("Configuration not found.");

  const row = config as Omit<AdminConfigDetail, "owner_username" | "data" | "version_count"> & {
    data: Record<string, unknown>;
  };
  const [{ data: profile }, { count }] = await Promise.all([
    db.from("profiles").select("username").eq("id", row.owner_id).maybeSingle(),
    db
      .from("configuration_versions")
      .select("id", { count: "exact", head: true })
      .eq("configuration_id", parsed.value),
  ]);

  return ok({
    ...row,
    owner_username: (profile as { username: string } | null)?.username ?? null,
    data: maskSensitive(row.data ?? {}),
    version_count: count ?? 0,
  });
}

const reasonRequiredSchema = z.string().trim().min(1, "A reason is required").max(500);

/** Restore an archived config to active (moderator+), audited. */
export async function moderateRestore(
  id: unknown,
  reason: unknown,
): Promise<ApiResponse<{ restored: boolean }>> {
  const me = await moderatorGuard();
  const idParsed = parseOr(uuidSchema, id);
  if (!idParsed.ok) return idParsed.error;
  const reasonParsed = parseOr(reasonRequiredSchema, reason);
  if (!reasonParsed.ok) return reasonParsed.error;

  const admin = getAdminClient();
  if ("error" in admin) return admin.error;
  const db = admin.client;

  const { data: target, error: fetchError } = await db
    .from("configurations")
    .select("id, owner_id, name")
    .eq("id", idParsed.value)
    .maybeSingle();
  if (fetchError) return dbError(fetchError);
  if (!target) return notFound("Configuration not found.");

  const { error } = await db
    .from("configurations")
    .update({ status: "active" })
    .eq("id", idParsed.value);
  if (error) return dbError(error);

  const t = target as { id: string; owner_id: string; name: string };
  await auditLog("config_moderated_restore", "configuration", idParsed.value, {
    reason: reasonParsed.value,
    metadata: { owner_id: t.owner_id, name: t.name },
    actorId: me.id,
  });
  await createNotification(
    t.owner_id,
    "Configuration restored by moderation",
    `Your configuration "${t.name}" was restored to active: ${reasonParsed.value}`,
    "/app/configs",
  );
  return ok({ restored: true });
}

/* ------------------------------------------------------------------ */
/* Platform analytics (date range)                                     */
/* ------------------------------------------------------------------ */

export const analyticsRangeSchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid start date"),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid end date"),
  })
  .refine(
    (v) => {
      const days = (new Date(v.to).getTime() - new Date(v.from).getTime()) / 86_400_000;
      return days >= 0 && days <= 365;
    },
    { message: "Date range must be between 0 and 365 days." },
  );

export interface PlatformAnalytics {
  newUsersPerDay: { date: string; count: number }[];
  configsPerDay: { date: string; count: number }[];
  activityPerDay: { date: string; count: number }[];
  configsByType: { name: string; value: number }[];
  configsByStatus: { name: string; value: number }[];
}

function dayKeysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end && days.length <= 366) {
    days.push(dayKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export async function getPlatformAnalytics(
  range: unknown,
): Promise<ApiResponse<PlatformAnalytics>> {
  await adminGuard();
  const parsed = parseOr(analyticsRangeSchema, range);
  if (!parsed.ok) return parsed.error;
  const { from, to } = parsed.value;

  const admin = getAdminClient();
  if ("error" in admin) return admin.error;
  const db = admin.client;

  const fromIso = new Date(`${from}T00:00:00Z`).toISOString();
  const toIso = new Date(`${to}T23:59:59.999Z`).toISOString();
  const days = dayKeysBetween(from, to);
  const bucket = (timestamps: string[]) => {
    const counts = new Map<string, number>();
    for (const ts of timestamps) {
      const key = dayKey(new Date(ts));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return days.map((date) => ({ date, count: counts.get(date) ?? 0 }));
  };

  const [usersRes, configsRes, activityRes, typeRes, statusRes] = await Promise.all([
    db.from("profiles").select("created_at").gte("created_at", fromIso).lte("created_at", toIso).limit(100000),
    db.from("configurations").select("created_at").gte("created_at", fromIso).lte("created_at", toIso).limit(100000),
    db.from("activity_logs").select("created_at").gte("created_at", fromIso).lte("created_at", toIso).limit(50000),
    db.from("configurations").select("config_type").limit(100000),
    db.from("configurations").select("status").limit(100000),
  ]);
  for (const res of [usersRes, configsRes, activityRes, typeRes, statusRes]) {
    if (res.error) return dbError(res.error);
  }

  const group = (rows: { [k: string]: string }[], key: string) => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const name = r[key] ?? "unknown";
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  return ok({
    newUsersPerDay: bucket(((usersRes.data ?? []) as { created_at: string }[]).map((r) => r.created_at)),
    configsPerDay: bucket(((configsRes.data ?? []) as { created_at: string }[]).map((r) => r.created_at)),
    activityPerDay: bucket(((activityRes.data ?? []) as { created_at: string }[]).map((r) => r.created_at)),
    configsByType: group((typeRes.data ?? []) as { config_type: string }[], "config_type"),
    configsByStatus: group((statusRes.data ?? []) as { status: string }[], "status"),
  });
}

/* ------------------------------------------------------------------ */
/* Audit logs with date range                                          */
/* ------------------------------------------------------------------ */

export interface AuditLogRow {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_username: string | null;
}

export const auditFilterSchema = z.object({
  action: z.string().trim().max(120).optional(),
  /** Matches an actor id exactly, or a username fragment. */
  actor: z.string().trim().max(120).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function listAuditActionTypes(): Promise<ApiResponse<string[]>> {
  await adminGuard();
  const admin = getAdminClient();
  if ("error" in admin) return admin.error;

  const { data, error } = await admin.client
    .from("audit_logs")
    .select("action")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) return dbError(error);
  const seen = new Set<string>();
  for (const r of (data ?? []) as { action: string }[]) seen.add(r.action);
  return ok([...seen].sort());
}

export async function listAuditLogsAdmin(
  filters: unknown,
  query: unknown,
): Promise<ApiResponse<PageResult<AuditLogRow>>> {
  await adminGuard();
  const fParsed = parseOr(auditFilterSchema, filters);
  if (!fParsed.ok) return fParsed.error;
  const qParsed = parseOr(listQuerySchema, query);
  if (!qParsed.ok) return qParsed.error;
  const f = fParsed.value;
  const q = qParsed.value;

  const admin = getAdminClient();
  if ("error" in admin) return admin.error;
  const db = admin.client;

  let builder = db
    .from("audit_logs")
    .select("id, actor_id, action, target_type, target_id, reason, metadata, created_at", {
      count: "exact",
    });
  if (f.action) builder = builder.eq("action", f.action);
  if (f.actor) {
    if (z.string().uuid().safeParse(f.actor).success) {
      builder = builder.eq("actor_id", f.actor);
    } else {
      const { data: profs } = await db
        .from("profiles")
        .select("id")
        .ilike("username", `%${escapeLike(f.actor)}%`)
        .limit(200);
      const ids = ((profs ?? []) as { id: string }[]).map((p) => p.id);
      if (ids.length === 0) {
        return ok({ items: [], total: 0, page: q.page, pageSize: q.pageSize });
      }
      builder = builder.in("actor_id", ids);
    }
  }
  if (f.from) builder = builder.gte("created_at", new Date(`${f.from}T00:00:00Z`).toISOString());
  if (f.to) builder = builder.lte("created_at", new Date(`${f.to}T23:59:59.999Z`).toISOString());
  if (q.search) {
    const s = escapeLike(q.search);
    builder = builder.or(`action.ilike.%${s}%,target_type.ilike.%${s}%`);
  }
  builder = builder.order("created_at", { ascending: false });

  const { from, to } = pageWindow(q.page, q.pageSize);
  const { data, error, count } = await builder.range(from, to);
  if (error) return dbError(error);

  const rows = (data ?? []) as Omit<AuditLogRow, "actor_username">[];
  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((id): id is string => !!id))];
  const usernames = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profs } = await db.from("profiles").select("id, username").in("id", actorIds);
    for (const p of (profs ?? []) as { id: string; username: string }[]) {
      usernames.set(p.id, p.username);
    }
  }

  return ok({
    items: rows.map((r) => ({
      ...r,
      actor_username: r.actor_id ? (usernames.get(r.actor_id) ?? null) : null,
    })),
    total: count ?? 0,
    page: q.page,
    pageSize: q.pageSize,
  });
}

/* ------------------------------------------------------------------ */
/* Overview extras                                                     */
/* ------------------------------------------------------------------ */

export async function getPendingTicketsCount(): Promise<ApiResponse<{ open: number }>> {
  await adminGuard();
  const admin = getAdminClient();
  if ("error" in admin) return admin.error;

  const { count, error } = await admin.client
    .from("support_tickets")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");
  if (error) return dbError(error);
  return ok({ open: count ?? 0 });
}

export interface RecentAdminAction {
  id: string;
  actor_id: string | null;
  actor_username: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  reason: string | null;
  created_at: string;
}

export async function getRecentAdminActions(): Promise<ApiResponse<RecentAdminAction[]>> {
  await adminGuard();
  const admin = getAdminClient();
  if ("error" in admin) return admin.error;
  const db = admin.client;

  const { data, error } = await db
    .from("audit_logs")
    .select("id, actor_id, action, target_type, target_id, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) return dbError(error);

  const rows = (data ?? []) as Omit<RecentAdminAction, "actor_username">[];
  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((id): id is string => !!id))];
  const usernames = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profs } = await db.from("profiles").select("id, username").in("id", actorIds);
    for (const p of (profs ?? []) as { id: string; username: string }[]) {
      usernames.set(p.id, p.username);
    }
  }

  return ok(
    rows.map((r) => ({
      ...r,
      actor_username: r.actor_id ? (usernames.get(r.actor_id) ?? null) : null,
    })),
  );
}

/* ------------------------------------------------------------------ */
/* Reports (real downloadable data)                                    */
/* ------------------------------------------------------------------ */

export interface UsersReportRow {
  id: string;
  username: string;
  display_name: string | null;
  email: string | null;
  roles: string;
  created_at: string;
}

export async function getUsersReport(): Promise<ApiResponse<UsersReportRow[]>> {
  await adminGuard();
  const admin = getAdminClient();
  if ("error" in admin) return admin.error;
  const db = admin.client;

  const profilesRes = await db
    .from("profiles")
    .select("id, username, display_name, created_at, user_roles(roles(name))")
    .order("created_at", { ascending: true })
    .limit(10000);
  if (profilesRes.error) return dbError(profilesRes.error);

  // Emails come from the Auth Admin API.
  const emails = new Map<string, string>();
  try {
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) break;
      const users = data?.users ?? [];
      for (const u of users) if (u.email) emails.set(u.id, u.email);
      if (users.length < 1000) break;
    }
  } catch {
    /* emails stay empty */
  }

  return ok(
    ((profilesRes.data ?? []) as unknown as RawUserRow[]).map((r) => ({
      id: r.id,
      username: r.username,
      display_name: r.display_name,
      email: emails.get(r.id) ?? null,
      roles: roleNames(r.user_roles).join("; "),
      created_at: r.created_at,
    })),
  );
}

export interface ConfigsReportRow {
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

export async function getConfigsReport(): Promise<ApiResponse<ConfigsReportRow[]>> {
  await adminGuard();
  const admin = getAdminClient();
  if ("error" in admin) return admin.error;
  const db = admin.client;

  const { data, error } = await db
    .from("configurations")
    .select("id, name, owner_id, config_type, environment, status, version, created_at, updated_at")
    .order("created_at", { ascending: true })
    .limit(20000);
  if (error) return dbError(error);

  const rows = (data ?? []) as Omit<ConfigsReportRow, "owner_username">[];
  const ownerIds = [...new Set(rows.map((r) => r.owner_id))];
  const usernames = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data: profs } = await db.from("profiles").select("id, username").in("id", ownerIds);
    for (const p of (profs ?? []) as { id: string; username: string }[]) {
      usernames.set(p.id, p.username);
    }
  }

  return ok(
    rows.map((r) => ({ ...r, owner_username: usernames.get(r.owner_id) ?? null })),
  );
}

export interface ActivityReportRow {
  id: string;
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  created_at: string;
}

export async function getActivityReport(): Promise<ApiResponse<ActivityReportRow[]>> {
  await adminGuard();
  const admin = getAdminClient();
  if ("error" in admin) return admin.error;

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data, error } = await admin.client
    .from("activity_logs")
    .select("id, actor_id, action, resource_type, resource_id, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20000);
  if (error) return dbError(error);
  return ok((data ?? []) as ActivityReportRow[]);
}

export interface AuditReportRow {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  reason: string | null;
  created_at: string;
}

export async function getAuditReport(): Promise<ApiResponse<AuditReportRow[]>> {
  await adminGuard();
  const admin = getAdminClient();
  if ("error" in admin) return admin.error;

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data, error } = await admin.client
    .from("audit_logs")
    .select("id, actor_id, action, target_type, target_id, reason, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20000);
  if (error) return dbError(error);
  return ok((data ?? []) as AuditReportRow[]);
}
