/**
 * Open-redirect protection for `next` / `redirect` params.
 *
 * Only same-origin relative paths are allowed:
 * - must start with a single "/" (no "//evil.com", no "\\evil.com")
 * - must not contain a scheme ("http:", "javascript:", ...)
 * - falls back to the provided default on any violation.
 */
export function getSafeRedirect(
  raw: string | null | undefined,
  fallback = "/app",
): string {
  if (!raw) return fallback;
  const target = raw.trim();
  if (!target.startsWith("/") || target.startsWith("//")) return fallback;
  // Reject backslash attempts and scheme-relative tricks.
  if (target.includes("\\")) return fallback;
  // Reject anything that parses as an absolute URL with a scheme.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(target)) return fallback;
  return target;
}
