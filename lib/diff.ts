/**
 * Pure JSON diff algorithm (brief §07/§08 version diff view).
 *
 * No dependencies, no I/O — unit-testable. Used by the configs DAL to
 * compare two configuration version snapshots.
 */

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type DiffChangeType = "added" | "removed" | "changed";

export interface DiffEntry {
  /** JSONPath-ish location, e.g. `server.host` or `ports[0]`. */
  path: string;
  type: DiffChangeType;
  oldValue?: JsonValue;
  newValue?: JsonValue;
}

export interface DiffSummary {
  added: number;
  removed: number;
  changed: number;
  total: number;
}

function joinPath(base: string, key: string): string {
  return base === "" ? key : `${base}.${key}`;
}

function isPlainObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Compute the structural diff between two JSON values.
 * Entries are emitted in deterministic (sorted-key) order.
 */
export function diffJson(
  oldValue: JsonValue,
  newValue: JsonValue,
  basePath = "",
): DiffEntry[] {
  const entries: DiffEntry[] = [];

  if (isPlainObject(oldValue) && isPlainObject(newValue)) {
    const keys = Array.from(
      new Set([...Object.keys(oldValue), ...Object.keys(newValue)]),
    ).sort();
    for (const key of keys) {
      const path = joinPath(basePath, key);
      const hasOld = Object.prototype.hasOwnProperty.call(oldValue, key);
      const hasNew = Object.prototype.hasOwnProperty.call(newValue, key);
      if (!hasOld) {
        entries.push({ path, type: "added", newValue: newValue[key] as JsonValue });
      } else if (!hasNew) {
        entries.push({ path, type: "removed", oldValue: oldValue[key] as JsonValue });
      } else {
        entries.push(
          ...diffJson(oldValue[key] as JsonValue, newValue[key] as JsonValue, path),
        );
      }
    }
    return entries;
  }

  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    const maxLen = Math.max(oldValue.length, newValue.length);
    for (let i = 0; i < maxLen; i++) {
      const path = `${basePath}[${i}]`;
      if (i >= oldValue.length) {
        entries.push({ path, type: "added", newValue: newValue[i] as JsonValue });
      } else if (i >= newValue.length) {
        entries.push({ path, type: "removed", oldValue: oldValue[i] as JsonValue });
      } else {
        entries.push(
          ...diffJson(oldValue[i] as JsonValue, newValue[i] as JsonValue, path),
        );
      }
    }
    return entries;
  }

  // Type change or primitive change (including object<->array swaps).
  if (!Object.is(oldValue, newValue)) {
    const label = basePath === "" ? "(root)" : basePath;
    entries.push({ path: label, type: "changed", oldValue, newValue });
  }
  return entries;
}

/** Count entries by change type. */
export function diffSummary(entries: DiffEntry[]): DiffSummary {
  let added = 0;
  let removed = 0;
  let changed = 0;
  for (const entry of entries) {
    if (entry.type === "added") added += 1;
    else if (entry.type === "removed") removed += 1;
    else changed += 1;
  }
  return { added, removed, changed, total: entries.length };
}
