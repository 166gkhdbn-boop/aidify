/**
 * Supabase environment helpers.
 *
 * Aidify works without a linked Supabase project: no real credentials live in
 * source, and missing env vars never crash the app — feature code uses these
 * helpers to render the honest "setup required" UI instead of faking auth.
 */

export interface PublicSupabaseEnv {
  url: string;
  anonKey: string;
}

export class AidifySetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AidifySetupError";
  }
}

/** Non-empty after trimming, or undefined. */
function envValue(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const value = raw.trim();
  return value.length > 0 ? value : undefined;
}

/** Public (browser-safe) Supabase config, or null when not configured. */
export function getPublicSupabaseEnv(): PublicSupabaseEnv | null {
  const url = envValue("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = envValue("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/** True when the browser-safe Supabase env vars are present. */
export function isSupabaseConfigured(): boolean {
  return getPublicSupabaseEnv() !== null;
}

/**
 * Throws AidifySetupError when the public Supabase env vars are missing.
 * Use on pages/routes that genuinely need Supabase; otherwise prefer
 * `isSupabaseConfigured()` to render the setup-required UI.
 */
export function requireSupabaseEnv(): PublicSupabaseEnv {
  const env = getPublicSupabaseEnv();
  if (!env) {
    throw new AidifySetupError(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment (see .env.example), " +
        "then restart the app.",
    );
  }
  return env;
}

/**
 * Returns the service-role key, or throws. SERVER-ONLY — never import this
 * from client components (the admin client module enforces this itself).
 * The key value is never exposed: only the error message leaves this module.
 */
export function getServiceRoleKey(): string {
  const key = envValue("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) {
    throw new AidifySetupError(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Server-side admin operations are " +
        "unavailable until it is configured (see .env.example).",
    );
  }
  return key;
}
