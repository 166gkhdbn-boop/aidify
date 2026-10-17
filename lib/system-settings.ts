import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "./supabase/admin";

/**
 * Reads from the `system_settings` table via the service-role client.
 *
 * Design rules (brief §10/§11 — settings must ACTUALLY work):
 * - 60s in-memory caches so proxy.ts never hits the DB per request.
 * - FAIL OPEN: any read failure (missing env, network error, bad data)
 *   returns the fallback — a DB hiccup must never lock everyone out or
 *   silently close registration.
 */

const CACHE_TTL_MS = 60_000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const settingsCache = new Map<string, CacheEntry<unknown>>();
const rolesCache = new Map<string, CacheEntry<string[]>>();

function isFresh<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  return !!entry && entry.expiresAt > Date.now();
}

function reportFailure(context: string, error: unknown): void {
  console.error(
    `[aidify] ${context}:`,
    error instanceof Error ? error.message : error,
  );
}

/**
 * Read a single system setting key. `fallback` is returned when the key is
 * missing, the value has an unexpected shape, or the read fails.
 */
export async function getSystemSetting<T>(
  key: string,
  fallback: T,
): Promise<T> {
  const cached = settingsCache.get(key);
  if (isFresh(cached)) return cached.value as T;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("system_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    if (error) throw error;

    const raw: unknown =
      data && typeof data === "object" && "value" in data
        ? (data as { value: unknown }).value
        : undefined;
    const value = (raw === undefined || raw === null ? fallback : raw) as T;
    settingsCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  } catch (error) {
    reportFailure(`system_settings read failed for "${key}"`, error);
    return fallback;
  }
}

/** Clear both caches (tests, and admin actions after a settings write). */
export function clearSystemSettingsCache(): void {
  settingsCache.clear();
  rolesCache.clear();
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

/** True when maintenance mode is on. Fails open (false) on read errors. */
export async function getMaintenanceMode(): Promise<boolean> {
  return toBoolean(await getSystemSetting<unknown>("maintenance_mode", false), false);
}

/** True when /register is allowed. Fails open (true) on read errors. */
export async function isRegistrationOpen(): Promise<boolean> {
  return toBoolean(await getSystemSetting<unknown>("registration_open", true), true);
}

interface UserRoleRow {
  roles: { name: string } | null;
}

/**
 * Cached (60s) lookup of a user's role names via the service-role client.
 * Fails open with [] — used by proxy.ts for the maintenance gate.
 */
export async function getCachedUserRoles(userId: string): Promise<string[]> {
  const cached = rolesCache.get(userId);
  if (isFresh(cached)) return cached.value;

  try {
    const admin: SupabaseClient = createAdminClient();
    const { data, error } = await admin
      .from("user_roles")
      .select("roles(name)")
      .eq("user_id", userId);

    if (error) throw error;

    const rows = (data ?? []) as unknown as UserRoleRow[];
    const roles = rows
      .map((row) => row.roles?.name)
      .filter((name): name is string => typeof name === "string");
    rolesCache.set(userId, { value: roles, expiresAt: Date.now() + CACHE_TTL_MS });
    return roles;
  } catch (error) {
    reportFailure("cached role lookup failed", error);
    return [];
  }
}

/** True when the cached roles include `administrator`. Fails open (false). */
export async function isCachedAdministrator(userId: string): Promise<boolean> {
  const roles = await getCachedUserRoles(userId);
  return roles.includes("administrator");
}
