/**
 * Sensitive-value masking for logs, activity metadata, and audit trails.
 *
 * Convention: any object key containing one of these substrings
 * (case-insensitive, separators ignored) is treated as secret and replaced
 * with "[REDACTED]": password, secret, token, api_key / apiKey, private_key.
 *
 * Pure function, no dependencies — safe to use anywhere server-side.
 */

const SENSITIVE_PARTS = [
  "password",
  "secret",
  "token",
  "apikey",
  "privatekey",
] as const;

export const REDACTED = "[REDACTED]";

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[_\-\s]/g, "");
  return SENSITIVE_PARTS.some((part) => normalized.includes(part));
}

/**
 * Recursively replace values under sensitive keys with "[REDACTED]".
 * Depth-capped to avoid runaway recursion on pathological input.
 */
export function maskSensitive<T>(value: T, depth = 0): T {
  if (depth > 10 || value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => maskSensitive(item, depth + 1)) as unknown as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(
      value as Record<string, unknown>,
    )) {
      out[key] = isSensitiveKey(key) ? REDACTED : maskSensitive(entry, depth + 1);
    }
    return out as unknown as T;
  }
  return value;
}
