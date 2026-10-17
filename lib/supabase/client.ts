import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseEnv, isSupabaseConfigured } from "./env";

/**
 * Browser Supabase client (client components / client-side code).
 * Uses the public anon key only. Returns null when Supabase is not
 * configured — callers should render the setup-required page instead.
 */
export function createClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  const env = getPublicSupabaseEnv();
  if (!env) return null;
  return createBrowserClient(env.url, env.anonKey);
}
