/**
 * Pure import helpers: conflict detection and rename/skip/replace decisions.
 *
 * This module has NO server-only / DB imports so it can be unit-tested in
 * isolation. `lib/dal/configs.ts` performs the DB reads (existing names) and
 * writes (inserts/deletes), and delegates every decision to the pure
 * functions here.
 */

import { createConfigSchema, type ImportConflictMode } from "./validators";

export interface ImportConflict {
  index: number;
  name: string;
  existingId: string;
}

export interface ImportItemError {
  index: number;
  message: string;
}

export interface ImportConflictDetection {
  /** True when every item is valid (conflicts do NOT invalidate). */
  valid: boolean;
  errors: ImportItemError[];
  conflicts: ImportConflict[];
}

/**
 * Pure conflict detection: given raw import items and the user's existing
 * name→id map (keys are lowercase names), validate every item against the
 * config schema and report name collisions. Never touches the database.
 *
 * A colliding name is a *conflict*, not an error — the UI shows a dialog
 * and the user picks rename/skip/replace.
 */
export function detectImportConflicts(
  rawItems: unknown[],
  existingByName: Map<string, string>,
): ImportConflictDetection {
  const errors: ImportItemError[] = [];
  const conflicts: ImportConflict[] = [];

  rawItems.forEach((item, index) => {
    const parsed = createConfigSchema.safeParse(item);
    if (!parsed.success) {
      errors.push({
        index,
        message:
          parsed.error.issues[0]?.message ?? "Invalid configuration.",
      });
      return;
    }
    const existingId = existingByName.get(parsed.data.name.toLowerCase());
    if (existingId) {
      conflicts.push({ index, name: parsed.data.name, existingId });
    }
  });

  return { valid: errors.length === 0, errors, conflicts };
}

/**
 * Pure rename helper: given a base name and the set of taken names
 * (lowercased), produce the first free variant. Never returns the base name
 * when it is taken, never returns a name present in `taken`, and never
 * exceeds the 200-char DB limit.
 */
export function nextAvailableName(base: string, taken: Set<string>): string {
  const key = (s: string) => s.toLowerCase();
  if (!taken.has(key(base))) return base;
  const first = `${base} (imported)`;
  if (!taken.has(key(first))) return first;
  let i = 2;
  while (i < 10000) {
    const suffix = ` (imported ${i})`;
    const candidate =
      base.length + suffix.length > 200
        ? base.slice(0, 200 - suffix.length) + suffix
        : base + suffix;
    if (!taken.has(key(candidate))) return candidate;
    i += 1;
  }
  return `${base.slice(0, 160)} (imported ${Date.now()})`;
}

export type ImportAction =
  | { kind: "insert"; name: string }
  | { kind: "skip" }
  | { kind: "replace"; existingId: string }
  | { kind: "rename"; name: string };

/**
 * Pure per-item import decision: given an item name, the chosen conflict
 * mode, and the current name→id map (keys lowercase), decide what happens.
 *
 * The map is NOT mutated here — the caller (DAL) applies the result and
 * updates its own map so later items in the same batch see fresh state.
 */
export function resolveImportAction(
  name: string,
  mode: ImportConflictMode,
  existingByName: Map<string, string>,
): ImportAction {
  const collisionId = existingByName.get(name.toLowerCase());
  if (!collisionId) return { kind: "insert", name };
  if (mode === "skip") return { kind: "skip" };
  if (mode === "replace") return { kind: "replace", existingId: collisionId };
  return {
    kind: "rename",
    name: nextAvailableName(name, new Set(existingByName.keys())),
  };
}
