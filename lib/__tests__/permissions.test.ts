/**
 * Permission tests: the pure role-implication rules in lib/permissions.ts.
 *
 * Note on what is NOT unit-tested here: role *membership* is read from the
 * database (user_roles / roles) through the service-role client in
 * lib/auth.ts — getUserRoles, requireUser, requireRole — and row-level
 * owner isolation is enforced by Postgres RLS policies. Both are verified
 * by the runnable SQL test strategy in `supabase/tests/rls_smoke.sql`,
 * which needs a linked Supabase project to execute; they cannot be covered
 * by unit tests without a live database, so they are deliberately excluded.
 * What IS tested: the pure implication logic over an already-fetched role
 * list — the exact rule requireRole() applies (administrator satisfies
 * moderator checks; client claims are never trusted, they are never an
 * input here).
 */
import { describe, expect, it } from "vitest";
import { roleSatisfies, isAdministratorRole } from "@/lib/permissions";

describe("roleSatisfies", () => {
  it("grants moderator checks to the moderator role", () => {
    expect(roleSatisfies("moderator", ["moderator"])).toBe(true);
  });
  it("grants moderator checks to the administrator role (implication)", () => {
    expect(roleSatisfies("moderator", ["administrator"])).toBe(true);
  });
  it("denies moderator checks with no roles", () => {
    expect(roleSatisfies("moderator", [])).toBe(false);
  });
  it("denies moderator checks to the plain user role", () => {
    expect(roleSatisfies("moderator", ["user"])).toBe(false);
  });
  it("grants administrator checks to the administrator role", () => {
    expect(roleSatisfies("administrator", ["administrator"])).toBe(true);
  });
  it("denies administrator checks to the moderator role", () => {
    expect(roleSatisfies("administrator", ["moderator"])).toBe(false);
  });
  it("denies administrator checks with no roles", () => {
    expect(roleSatisfies("administrator", [])).toBe(false);
  });
  it("ignores unknown role names", () => {
    expect(roleSatisfies("moderator", ["superadmin"])).toBe(false);
    expect(roleSatisfies("administrator", ["superadmin"])).toBe(false);
  });
});

describe("isAdministratorRole", () => {
  it("is true only when administrator is held", () => {
    expect(isAdministratorRole(["administrator"])).toBe(true);
    expect(isAdministratorRole(["administrator", "moderator"])).toBe(true);
    expect(isAdministratorRole(["moderator"])).toBe(false);
    expect(isAdministratorRole([])).toBe(false);
  });
});
