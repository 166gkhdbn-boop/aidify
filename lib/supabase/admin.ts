import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseEnv, getServiceRoleKey } from "./env";

/**
 * Supabase admin client with the service-role key. BYPASSES RLS — use only
 * for trusted server-side operations (role checks, admin actions, webhooks).
 *
 * Throws AidifySetupError (clear message, key value never exposed) when the
 * service-role key is missing. SERVER-ONLY via "server-only" import.
 */
export function createAdminClient(): SupabaseClient {
  const env = getPublicSupabaseEnv();
  // Public vars are still required to know which project to target.
  if (!env) {
    throw new Error(
      "AidifySetupError: NEXT_PUBLIC_SUPABASE_URL is not set. The admin " +
        "client cannot target a project.",
    );
  }
  const serviceRoleKey = getServiceRoleKey();
  return createClient(env.url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
