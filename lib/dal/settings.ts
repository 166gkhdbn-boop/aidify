import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Public system settings (brief §10/§11: settings that ACTUALLY work).
 *
 * Read via the service-role client because `system_settings` has no public
 * read policy; only the small public key set below is ever exposed. Results
 * are cached in memory for 60 seconds. Used by proxy.ts, auth flows, and UI.
 */

export interface PublicSettings {
  site_name: string;
  registration_open: boolean;
  maintenance_mode: boolean;
  announcement_banner: string | null;
}

const PUBLIC_KEYS = [
  "site_name",
  "registration_open",
  "maintenance_mode",
  "announcement_banner",
] as const;

const DEFAULTS: PublicSettings = {
  site_name: "Aidify",
  registration_open: true,
  maintenance_mode: false,
  announcement_banner: null,
};

const CACHE_TTL_MS = 60_000;

let cache: { at: number; data: PublicSettings } | null = null;

function coerce(key: string, value: unknown): unknown {
  switch (key) {
    case "site_name":
      return typeof value === "string" && value.length > 0
        ? value
        : DEFAULTS.site_name;
    case "registration_open":
      return typeof value === "boolean" ? value : DEFAULTS.registration_open;
    case "maintenance_mode":
      return typeof value === "boolean" ? value : DEFAULTS.maintenance_mode;
    case "announcement_banner":
      return typeof value === "string" && value.length > 0 ? value : null;
    default:
      return value;
  }
}

/** Public settings with safe defaults; never throws. */
export async function getPublicSettings(): Promise<PublicSettings> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("system_settings")
      .select("key, value")
      .in("key", [...PUBLIC_KEYS]);
    if (error) throw error;
    const merged: PublicSettings = { ...DEFAULTS };
    for (const row of (data ?? []) as { key: string; value: unknown }[]) {
      if (row.key === "site_name") merged.site_name = coerce(row.key, row.value) as string;
      else if (row.key === "registration_open")
        merged.registration_open = coerce(row.key, row.value) as boolean;
      else if (row.key === "maintenance_mode")
        merged.maintenance_mode = coerce(row.key, row.value) as boolean;
      else if (row.key === "announcement_banner")
        merged.announcement_banner = coerce(row.key, row.value) as string | null;
    }
    cache = { at: Date.now(), data: merged };
    return merged;
  } catch (caught) {
    console.error("[aidify] getPublicSettings failed:", caught);
    return cache?.data ?? { ...DEFAULTS };
  }
}

/**
 * Read any single system_settings key via service role (internal use, e.g.
 * `max_configs_per_user`). Returns null when unset or unreadable.
 */
export async function getSystemSetting(key: string): Promise<unknown> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("system_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) throw error;
    return (data as { value: unknown } | null)?.value ?? null;
  } catch (caught) {
    console.error(`[aidify] getSystemSetting(${key}) failed:`, caught);
    return null;
  }
}
