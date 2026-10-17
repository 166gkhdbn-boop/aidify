/**
 * Pure role/permission helpers — DB-free so they are unit-testable.
 *
 * The actual role membership lives in `user_roles`/`roles` and is read
 * server-side via the service-role client in `lib/auth.ts` (owner-isolation
 * for data rows is enforced by RLS, verified by `supabase/tests/rls_smoke.sql`).
 * These helpers only encode the implication rules over an already-fetched
 * role list: client-supplied claims are never trusted.
 */

export type AidifyRole = "administrator" | "moderator";

/**
 * True when a user's `held` roles satisfy a `required` role check.
 *
 * - `administrator` is the top role: it also satisfies `moderator` checks.
 * - Unknown role names are ignored — they never grant access.
 */
export function roleSatisfies(required: AidifyRole, held: string[]): boolean {
  if (required === "moderator") {
    return held.includes("moderator") || held.includes("administrator");
  }
  return held.includes("administrator");
}

/** True when the user's roles include `administrator`. */
export function isAdministratorRole(held: string[]): boolean {
  return held.includes("administrator");
}
