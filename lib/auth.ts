import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { AidifySetupError } from "./supabase/env";
import { createAdminClient } from "./supabase/admin";
import { createServerSupabaseClient } from "./supabase/server";
import { roleSatisfies, type AidifyRole } from "./permissions";

export type { AidifyRole } from "./permissions";

/**
 * Server-side auth helpers (brief §WAVE PLAN interface).
 *
 * Identity always comes from the verified Supabase session. Role checks hit
 * the database through the service-role client — client-supplied claims
 * (owner_id, role, permissions) are NEVER trusted.
 */

/** The currently signed-in user, or null (unauthenticated / not configured). */
export async function getSessionUser(): Promise<User | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

/**
 * The currently signed-in user, redirecting to /login when absent.
 * Preserves the requested path so auth can send the user back after login.
 */
export async function requireUser(nextPath?: string): Promise<User> {
  const user = await getSessionUser();
  if (!user) {
    const to = nextPath
      ? `/login?next=${encodeURIComponent(nextPath)}`
      : "/login";
    redirect(to);
  }
  return user;
}

export interface RoleCheckResult {
  user: User;
  roles: string[];
  hasRole: boolean;
}

interface UserRoleRow {
  roles: { name: string } | null;
}

/**
 * Look up the signed-in user's roles via the service-role client.
 * Throws AidifySetupError when Supabase is not configured.
 */
export async function getUserRoles(user: User): Promise<string[]> {
  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    if (error instanceof AidifySetupError) throw error;
    throw error;
  }

  const { data, error } = await admin
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", user.id);

  if (error) {
    console.error("[aidify] role lookup failed:", error.message);
    return [];
  }

  const rows = (data ?? []) as unknown as UserRoleRow[];
  return rows
    .map((row) => row.roles?.name)
    .filter((name): name is string => typeof name === "string");
}

/**
 * Require the signed-in user to hold one of the given roles.
 * - Unauthenticated → redirect to /login.
 * - Authenticated but lacking the role → redirect to /app (no dead ends).
 * - The special role "administrator" also satisfies "moderator" checks.
 *
 * Roles are read server-side from user_roles/roles — never from client claims.
 */
export async function requireRole(
  role: AidifyRole,
  nextPath?: string,
): Promise<RoleCheckResult> {
  const user = await requireUser(nextPath);
  const roles = await getUserRoles(user);

  // Administrator also satisfies moderator checks (lib/permissions.ts).
  const hasRole = roleSatisfies(role, roles);

  if (!hasRole) {
    redirect("/app");
  }

  return { user, roles, hasRole: true };
}

/** True when the user holds the administrator role. */
export async function isAdministrator(user: User): Promise<boolean> {
  const roles = await getUserRoles(user);
  return roles.includes("administrator");
}
