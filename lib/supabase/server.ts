import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getPublicSupabaseEnv } from "./env";

/**
 * Server Supabase client for Server Components, Server Actions and Route
 * Handlers. Reads/writes auth cookies via next/headers (async API in Next 16).
 *
 * Returns null when Supabase is not configured — feature code must render the
 * setup-required page in that case instead of faking auth.
 *
 * SERVER-ONLY: imports "server-only" so it can never be bundled into client
 * components. Uses the public anon key; RLS still applies.
 */
export async function createServerSupabaseClient(): Promise<SupabaseClient | null> {
  const env = getPublicSupabaseEnv();
  if (!env) return null;

  // Next 16: cookies() is async.
  const cookieStore = await cookies();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component where set was not allowed —
          // session refresh is handled by proxy.ts in that path.
        }
      },
    },
  });
}
