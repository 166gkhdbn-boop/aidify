import "server-only";

import { randomUUID } from "crypto";
import { requireUser } from "@/lib/auth";
import { err, ok, ApiErrorCode, type ApiResponse } from "@/lib/api-response";
import {
  createProxyUserSchema,
  updateProxyUserSchema,
  uuidSchema,
  type CreateProxyUserInput,
  type UpdateProxyUserInput,
} from "@/lib/validators";
import { dbError, getAdminClient, parseOr } from "./helpers";

/**
 * Proxy users data-access layer.
 *
 * Manages the `panel_users` table (VLESS/Trojan proxy users) that the
 * Supabase Edge Function `proxy` serves. Every function requires a signed-in
 * Aidify user (requireUser) — proxy users themselves never log in here.
 *
 * data_limit is stored in BYTES (NULL = unlimited).
 * expires_at NULL = never expires.
 */

export const GB = 1073741824;

/** Host that serves the proxy protocols (Edge Function). */
export const PROXY_HOST = "rdcnkkhqangukrgfehdj.supabase.co";

export interface ProxyUserRow {
  id: string;
  name: string;
  uuid: string;
  trojan_password: string | null;
  enabled: boolean;
  data_limit: number | null;
  expires_at: string | null;
  total_up: number;
  total_down: number;
  created_at: string;
  last_seen: string | null;
}

export type ProxyUserStatus =
  | "active"
  | "disabled"
  | "expired"
  | "quota_exceeded";

export function usedBytes(u: Pick<ProxyUserRow, "total_up" | "total_down">): number {
  return Number(u.total_up || 0) + Number(u.total_down || 0);
}

export function proxyUserStatus(u: ProxyUserRow): ProxyUserStatus {
  if (!u.enabled) return "disabled";
  if (u.expires_at && new Date(u.expires_at).getTime() < Date.now())
    return "expired";
  if (
    u.data_limit != null &&
    usedBytes(u) >= Number(u.data_limit)
  )
    return "quota_exceeded";
  return "active";
}

export function isProxyUserActive(u: ProxyUserRow): boolean {
  return proxyUserStatus(u) === "active";
}

export function formatBytes(bytes: number): string {
  const b = Number(bytes || 0);
  if (b < 1024) return `${b} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = b;
  let i = -1;
  do {
    v /= 1024;
    i++;
  } while (v >= 1024 && i < units.length - 1);
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export function daysUntilExpiry(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
}

const SELECT = "*";

export async function listProxyUsers(): Promise<ApiResponse<ProxyUserRow[]>> {
  await requireUser();
  const admin = getAdminClient();
  if ("error" in admin) return admin.error;
  const { data, error } = await admin.client
    .from("panel_users")
    .select(SELECT)
    .order("created_at", { ascending: true });
  if (error) return dbError(error);
  return ok((data ?? []) as ProxyUserRow[]);
}

export async function getProxyUser(
  id: string,
): Promise<ApiResponse<ProxyUserRow>> {
  await requireUser();
  const parsedId = parseOr(uuidSchema, id);
  if (!parsedId.ok) return parsedId.error;
  const admin = getAdminClient();
  if ("error" in admin) return admin.error;
  const { data, error } = await admin.client
    .from("panel_users")
    .select(SELECT)
    .eq("id", parsedId.value)
    .maybeSingle();
  if (error) return dbError(error);
  if (!data)
    return err(ApiErrorCode.NOT_FOUND, "User not found.");
  return ok(data as ProxyUserRow);
}

export async function createProxyUser(
  input: CreateProxyUserInput,
): Promise<ApiResponse<ProxyUserRow>> {
  await requireUser();
  const parsed = parseOr(createProxyUserSchema, input);
  if (!parsed.ok) return parsed.error;
  const admin = getAdminClient();
  if ("error" in admin) return admin.error;

  const row: Record<string, unknown> = {
    name: parsed.value.name,
    uuid: randomUUID(),
    trojan_password: Math.random().toString(36).slice(2, 14),
    enabled: true,
  };
  if (parsed.value.data_limit_gb != null)
    row.data_limit = Math.round(parsed.value.data_limit_gb * GB);
  if (parsed.value.expires_at) row.expires_at = parsed.value.expires_at;

  const { data, error } = await admin.client
    .from("panel_users")
    .insert(row)
    .select(SELECT)
    .single();
  if (error) return dbError(error);
  return ok(data as ProxyUserRow);
}

export async function updateProxyUser(
  id: string,
  input: UpdateProxyUserInput,
): Promise<ApiResponse<ProxyUserRow>> {
  await requireUser();
  const parsedId = parseOr(uuidSchema, id);
  if (!parsedId.ok) return parsedId.error;
  const parsed = parseOr(updateProxyUserSchema, input);
  if (!parsed.ok) return parsed.error;
  const admin = getAdminClient();
  if ("error" in admin) return admin.error;

  const patch: Record<string, unknown> = {};
  if (parsed.value.name !== undefined) patch.name = parsed.value.name;
  if (parsed.value.enabled !== undefined) patch.enabled = parsed.value.enabled;
  if (parsed.value.data_limit_gb !== undefined)
    patch.data_limit =
      parsed.value.data_limit_gb == null
        ? null
        : Math.round(parsed.value.data_limit_gb * GB);
  if (parsed.value.expires_at !== undefined)
    patch.expires_at = parsed.value.expires_at || null;
  if (Object.keys(patch).length === 0)
    return err(ApiErrorCode.VALIDATION, "Nothing to update.");

  const { data, error } = await admin.client
    .from("panel_users")
    .update(patch)
    .eq("id", parsedId.value)
    .select(SELECT)
    .single();
  if (error) return dbError(error);
  return ok(data as ProxyUserRow);
}

export async function deleteProxyUser(
  id: string,
): Promise<ApiResponse<{ ok: true }>> {
  await requireUser();
  const parsedId = parseOr(uuidSchema, id);
  if (!parsedId.ok) return parsedId.error;
  const admin = getAdminClient();
  if ("error" in admin) return admin.error;
  const { error } = await admin.client
    .from("panel_users")
    .delete()
    .eq("id", parsedId.value);
  if (error) return dbError(error);
  return ok({ ok: true });
}

export async function resetProxyUsage(
  id: string,
): Promise<ApiResponse<ProxyUserRow>> {
  await requireUser();
  const parsedId = parseOr(uuidSchema, id);
  if (!parsedId.ok) return parsedId.error;
  const admin = getAdminClient();
  if ("error" in admin) return admin.error;
  const { data, error } = await admin.client
    .from("panel_users")
    .update({ total_up: 0, total_down: 0 })
    .eq("id", parsedId.value)
    .select(SELECT)
    .single();
  if (error) return dbError(error);
  return ok(data as ProxyUserRow);
}

export async function regenerateProxyUuid(
  id: string,
): Promise<ApiResponse<ProxyUserRow>> {
  await requireUser();
  const parsedId = parseOr(uuidSchema, id);
  if (!parsedId.ok) return parsedId.error;
  const admin = getAdminClient();
  if ("error" in admin) return admin.error;
  const { data, error } = await admin.client
    .from("panel_users")
    .update({ uuid: randomUUID() })
    .eq("id", parsedId.value)
    .select(SELECT)
    .single();
  if (error) return dbError(error);
  return ok(data as ProxyUserRow);
}

export interface ProxyStats {
  total: number;
  active: number;
  disabled: number;
  expired: number;
  quotaExceeded: number;
  totalUsageBytes: number;
  expiringSoon: number;
}

export async function getProxyStats(): Promise<ApiResponse<ProxyStats>> {
  const res = await listProxyUsers();
  if (!res.ok) return res;
  const users = res.data;
  const stats: ProxyStats = {
    total: users.length,
    active: 0,
    disabled: 0,
    expired: 0,
    quotaExceeded: 0,
    totalUsageBytes: 0,
    expiringSoon: 0,
  };
  for (const u of users) {
    stats.totalUsageBytes += usedBytes(u);
    const s = proxyUserStatus(u);
    if (s === "active") stats.active++;
    else if (s === "disabled") stats.disabled++;
    else if (s === "expired") stats.expired++;
    else stats.quotaExceeded++;
    const d = daysUntilExpiry(u.expires_at);
    if (d !== null && d >= 0 && d <= 7) stats.expiringSoon++;
  }
  return ok(stats);
}

/* ---------------- protocols (panel_settings) ---------------- */

export interface ProtocolSetting {
  key: string;
  value: string;
  updated_at: string;
}

export async function listProtocolSettings(): Promise<
  ApiResponse<ProtocolSetting[]>
> {
  await requireUser();
  const admin = getAdminClient();
  if ("error" in admin) return admin.error;
  const { data, error } = await admin.client
    .from("panel_settings")
    .select("key,value,updated_at");
  if (error) return dbError(error);
  return ok((data ?? []) as ProtocolSetting[]);
}

export async function setProtocolSetting(
  key: string,
  value: boolean,
): Promise<ApiResponse<{ ok: true }>> {
  await requireUser();
  const allowed = ["vless_enabled", "trojan_enabled", "xhttp_enabled"];
  if (!allowed.includes(key))
    return err(ApiErrorCode.VALIDATION, "Unknown protocol setting.");
  const admin = getAdminClient();
  if ("error" in admin) return admin.error;
  const { error } = await admin.client.from("panel_settings").upsert(
    { key, value: String(value), updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
  if (error) return dbError(error);
  return ok({ ok: true });
}

/* ---------------- config links ---------------- */

export interface UserLinks {
  vless: string | null;
  trojan: string | null;
  xhttp: string | null;
  subscription: string;
}

export function buildUserLinks(
  user: ProxyUserRow,
  protocols: Record<string, string>,
  host: string = PROXY_HOST,
): UserLinks {
  const enc = encodeURIComponent(user.name);
  let vless: string | null = null;
  let trojan: string | null = null;
  let xhttp: string | null = null;
  const all: string[] = [];

  if (protocols.vless_enabled !== "false") {
    const p = new URLSearchParams({
      encryption: "none",
      security: "tls",
      sni: host,
      fp: "randomized",
      type: "ws",
      host,
      path: "/functions/v1/proxy/ws",
    });
    vless = `vless://${user.uuid}@${host}:443?${p}#${enc}%20(VLESS)`;
    all.push(vless);
  }
  if (protocols.trojan_enabled === "true" && user.trojan_password) {
    const p = new URLSearchParams({
      security: "tls",
      sni: host,
      fp: "randomized",
      type: "ws",
      host,
      path: "/functions/v1/proxy/trojan",
    });
    trojan = `trojan://${encodeURIComponent(user.trojan_password)}@${host}:443?${p}#${enc}%20(Trojan)`;
    all.push(trojan);
  }
  if (protocols.xhttp_enabled === "true") {
    const p = new URLSearchParams({
      encryption: "none",
      security: "tls",
      sni: host,
      fp: "randomized",
      type: "xhttp",
      host,
      path: "/functions/v1/proxy/xhttp",
      mode: "packet-up",
    });
    xhttp = `vless://${user.uuid}@${host}:443?${p}#${enc}%20(XHTTP)`;
    all.push(xhttp);
  }
  const subscription = Buffer.from(all.join("\n"), "utf-8").toString("base64");
  return { vless, trojan, xhttp, subscription };
}
