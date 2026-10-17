import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "./supabase/admin";

/**
 * Idempotent `profiles` row creation via the service-role client.
 *
 * Called after sign-in, sign-up, and the /auth/callback exchange so the
 * profile row always exists for an authenticated user. Never throws — a
 * profile failure must not break the auth flow.
 */

export interface EnsureProfileInput {
  id: string;
  email?: string | null;
  displayName?: string | null;
}

/** The `profiles.username` CHECK constraint: ^[a-zA-Z0-9_.-]{3,32}$ */
function sanitizeUsernameBase(email?: string | null): string {
  const localPart = email?.split("@")[0] ?? "";
  let base = localPart
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "")
    .slice(0, 24);
  if (base.length < 3) {
    base = `user${base}`.slice(0, 24);
    if (base.length < 3) base = "user";
  }
  return base;
}

async function generateUniqueUsername(
  admin: SupabaseClient,
  email?: string | null,
): Promise<string> {
  const base = sanitizeUsernameBase(email);

  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate =
      attempt === 0 ? base : `${base}_${attempt}`.slice(0, 32);
    const { data, error } = await admin
      .from("profiles")
      .select("id")
      .eq("username", candidate)
      .maybeSingle();
    if (error) throw error;
    if (!data) return candidate;
  }

  // Practically unreachable; keeps the insert from ever violating UNIQUE.
  return `user_${Date.now().toString(36)}`.slice(0, 32);
}

export async function ensureProfile(input: EnsureProfileInput): Promise<void> {
  try {
    const admin: SupabaseClient = createAdminClient();

    const { data: existing, error: selectError } = await admin
      .from("profiles")
      .select("id")
      .eq("id", input.id)
      .maybeSingle();
    if (selectError) throw selectError;
    if (existing) return;

    const username = await generateUniqueUsername(admin, input.email);
    const displayName = input.displayName?.trim() || username;

    const { error: insertError } = await admin.from("profiles").insert({
      id: input.id,
      username,
      display_name: displayName,
    });
    if (insertError) throw insertError;
  } catch (error) {
    console.error(
      "[aidify] ensureProfile failed:",
      error instanceof Error ? error.message : error,
    );
  }
}
