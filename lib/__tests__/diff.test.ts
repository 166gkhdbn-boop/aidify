/**
 * Unit tests for the pure JSON diff algorithm (lib/diff.ts).
 * Wave 4 (agent H) owns the full suite; these cover the version-diff core.
 */
import { describe, expect, it } from "vitest";
import { diffJson, diffSummary, type DiffEntry } from "@/lib/diff";

function types(entries: DiffEntry[]): string[] {
  return entries.map((e) => `${e.path}:${e.type}`);
}

describe("diffJson", () => {
  it("returns no entries for identical values", () => {
    expect(diffJson({ a: 1 }, { a: 1 })).toEqual([]);
    expect(diffJson([1, 2], [1, 2])).toEqual([]);
    expect(diffJson(null, null)).toEqual([]);
  });

  it("detects changed primitives", () => {
    const entries = diffJson({ a: 1, b: "x" }, { a: 2, b: "x" });
    expect(types(entries)).toEqual(["a:changed"]);
    expect(entries[0]).toMatchObject({ oldValue: 1, newValue: 2 });
  });

  it("detects added and removed keys", () => {
    const entries = diffJson({ a: 1 }, { b: 2 });
    expect(types(entries)).toEqual(["a:removed", "b:added"]);
  });

  it("walks nested objects with dotted paths", () => {
    const entries = diffJson(
      { server: { host: "a", port: 80 } },
      { server: { host: "b", port: 80 } },
    );
    expect(types(entries)).toEqual(["server.host:changed"]);
  });

  it("diffs arrays index-wise with bracket paths", () => {
    const entries = diffJson({ ports: [80, 443] }, { ports: [80, 8080, 443] });
    expect(types(entries)).toEqual(["ports[1]:changed", "ports[2]:added"]);
  });

  it("treats type changes as changed", () => {
    const entries = diffJson({ a: [1] }, { a: { x: 1 } });
    expect(types(entries)).toEqual(["a:changed"]);
  });

  it("handles root-level primitive change", () => {
    const entries = diffJson("a", "b");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.path).toBe("(root)");
    expect(entries[0]?.type).toBe("changed");
  });

  it("emits entries in sorted key order", () => {
    const entries = diffJson({ z: 1, a: 1 }, { z: 2, a: 2 });
    expect(entries.map((e) => e.path)).toEqual(["a", "z"]);
  });
});

describe("diffSummary", () => {
  it("counts entries by change type", () => {
    const entries = diffJson({ a: 1, b: 2 }, { a: 9, c: 3 });
    expect(diffSummary(entries)).toEqual({
      added: 1,
      removed: 1,
      changed: 1,
      total: 3,
    });
  });
});
