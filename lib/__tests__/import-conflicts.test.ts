/**
 * Import-conflict tests: the pure decision logic in lib/import.ts.
 *
 * These functions are DB-free: callers supply the existing name→id map
 * (keys are lowercase names). The DB reads/writes stay in lib/dal/configs.ts.
 */
import { describe, expect, it } from "vitest";
import {
  detectImportConflicts,
  nextAvailableName,
  resolveImportAction,
} from "@/lib/import";

function item(name: string, overrides: Record<string, unknown> = {}) {
  return {
    name,
    config_type: "application",
    environment: "development",
    data: {},
    ...overrides,
  };
}

function existing(...names: string[]): Map<string, string> {
  const map = new Map<string, string>();
  names.forEach((n, i) => map.set(n.toLowerCase(), `existing-id-${i}`));
  return map;
}

describe("detectImportConflicts", () => {
  it("returns no conflicts when names are unique", () => {
    const d = detectImportConflicts(
      [item("Alpha"), item("Beta")],
      existing("Gamma"),
    );
    expect(d.valid).toBe(true);
    expect(d.errors).toEqual([]);
    expect(d.conflicts).toEqual([]);
  });
  it("reports conflicts with the existing id", () => {
    const d = detectImportConflicts(
      [item("Alpha"), item("New one")],
      existing("alpha", "other"),
    );
    expect(d.valid).toBe(true); // conflicts are not validation errors
    expect(d.conflicts).toEqual([
      { index: 0, name: "Alpha", existingId: "existing-id-0" },
    ]);
  });
  it("matches names case-insensitively", () => {
    const d = detectImportConflicts([item("ALPHA")], existing("alpha"));
    expect(d.conflicts).toHaveLength(1);
  });
  it("collects validation errors with item indexes", () => {
    const d = detectImportConflicts(
      [item("OK"), { name: "Bad", config_type: "nope" }],
      existing(),
    );
    expect(d.valid).toBe(false);
    expect(d.errors).toHaveLength(1);
    expect(d.errors[0]?.index).toBe(1);
    expect(d.conflicts).toEqual([]);
  });
  it("does not report conflicts for invalid items", () => {
    const d = detectImportConflicts(
      [{ name: "Alpha", config_type: "nope" }],
      existing("alpha"),
    );
    expect(d.valid).toBe(false);
    expect(d.conflicts).toEqual([]);
  });
  it("flags multiple collisions at their own indexes", () => {
    const d = detectImportConflicts(
      [item("a"), item("b"), item("c")],
      existing("a", "c"),
    );
    expect(d.conflicts.map((c) => c.index)).toEqual([0, 2]);
  });
});

describe("nextAvailableName", () => {
  it("returns the base name when it is free", () => {
    expect(nextAvailableName("Config", new Set(["other"]))).toBe("Config");
  });
  it("appends (imported) on first collision", () => {
    expect(nextAvailableName("Config", new Set(["config"]))).toBe(
      "Config (imported)",
    );
  });
  it("numbers suffixes when the first variant is taken", () => {
    expect(
      nextAvailableName("Config", new Set(["config", "config (imported)"])),
    ).toBe("Config (imported 2)");
  });
  it("treats taken names case-insensitively", () => {
    // Contract: `taken` holds lowercased names; "Config" is taken.
    expect(nextAvailableName("config", new Set(["config"]))).toBe(
      "config (imported)",
    );
  });
  it("never exceeds 200 characters", () => {
    const base = "x".repeat(200);
    const taken = new Set([base.toLowerCase(), `${base} (imported)`.toLowerCase()]);
    const name = nextAvailableName(base, taken);
    expect(name.length).toBeLessThanOrEqual(200);
    expect(taken.has(name.toLowerCase())).toBe(false);
  });
});

describe("resolveImportAction", () => {
  it("inserts when there is no collision", () => {
    expect(
      resolveImportAction("Fresh", "rename", existing("other")),
    ).toEqual({ kind: "insert", name: "Fresh" });
  });
  it("skips on collision with mode=skip", () => {
    expect(resolveImportAction("Alpha", "skip", existing("alpha"))).toEqual({
      kind: "skip",
    });
  });
  it("replaces on collision with mode=replace, carrying the existing id", () => {
    expect(
      resolveImportAction("Alpha", "replace", existing("alpha")),
    ).toEqual({ kind: "replace", existingId: "existing-id-0" });
  });
  it("renames on collision with mode=rename", () => {
    const action = resolveImportAction("Alpha", "rename", existing("alpha"));
    expect(action.kind).toBe("rename");
    if (action.kind === "rename") {
      expect(action.name).toBe("Alpha (imported)");
      expect(existing("alpha").has(action.name.toLowerCase())).toBe(false);
    }
  });
  it("numbers the rename when the imported variant is taken", () => {
    const action = resolveImportAction(
      "Alpha",
      "rename",
      existing("alpha", "alpha (imported)"),
    );
    expect(action).toEqual({
      kind: "rename",
      name: "Alpha (imported 2)",
    });
  });
  it("never silently overwrites: rename never returns a taken name", () => {
    const map = existing("alpha", "alpha (imported)", "alpha (imported 2)");
    const action = resolveImportAction("ALPHA", "rename", map);
    if (action.kind === "rename") {
      expect(map.has(action.name.toLowerCase())).toBe(false);
    } else {
      throw new Error("expected a rename action");
    }
  });
});
