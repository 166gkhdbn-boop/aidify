import "server-only";

import { headers } from "next/headers";
import {
  checkRateLimit,
  getClientIp,
  RateLimitPresets,
  type RateLimitConfig,
} from "@/lib/rate-limit";
import {
  err,
  ApiErrorCode,
  fromUnknownError,
  type ApiResponse,
} from "@/lib/api-response";

/**
 * Shared helpers for thin server actions (wave 2G).
 *
 * - `writeLimit(route)`: 30 mutations/minute per IP (RateLimitPresets.write).
 *   Returns a RATE_LIMITED envelope when exceeded, null otherwise.
 * - `runAction(fn)`: executes a DAL call, re-throwing Next.js redirect errors
 *   (from requireUser/requireRole) and converting anything else to the
 *   standard envelope.
 */

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export async function writeLimit(
  route: string,
  config: RateLimitConfig = RateLimitPresets.write,
): Promise<ApiResponse<never> | null> {
  const headerStore = await headers();
  const request = new Request("http://localhost/", { headers: headerStore });
  const key = `${getClientIp(request)}:${route}`;
  const result = checkRateLimit(key, config);
  if (!result.allowed) {
    return err(
      ApiErrorCode.RATE_LIMITED,
      "Too many requests. Please try again shortly.",
    );
  }
  return null;
}

export async function runAction<T>(
  fn: () => Promise<ApiResponse<T>>,
): Promise<ApiResponse<T>> {
  try {
    return await fn();
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return fromUnknownError(error);
  }
}
