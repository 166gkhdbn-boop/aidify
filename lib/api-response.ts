/**
 * Standard API/Server-Action response envelope (brief §WAVE PLAN interface).
 *
 * Success: { ok: true, data }
 * Failure: { ok: false, error: { code, message } }
 */

export interface ApiError {
  code: string;
  message: string;
}

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

/** Build a success envelope. */
export function ok<T>(data: T): ApiResponse<T> {
  return { ok: true, data };
}

/** Build a failure envelope. Message must be safe to show to the client. */
export function err(code: string, message: string): ApiResponse<never> {
  return { ok: false, error: { code, message } };
}

/** Common error codes shared across Aidify features. */
export const ApiErrorCode = {
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  VALIDATION: "VALIDATION",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  NOT_CONFIGURED: "NOT_CONFIGURED",
  INTERNAL: "INTERNAL",
} as const;

export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

/**
 * Convert an unknown caught error into a safe ApiResponse failure.
 * Never leaks stack traces or internal details to the client.
 */
export function fromUnknownError(error: unknown): ApiResponse<never> {
  if (error instanceof Error && error.name === "AidifySetupError") {
    return err(ApiErrorCode.NOT_CONFIGURED, error.message);
  }
  // Log server-side for debugging; return a generic client-safe message.
  console.error("[aidify] unexpected error:", error);
  return err(
    ApiErrorCode.INTERNAL,
    "Something went wrong. Please try again later.",
  );
}

/**
 * Unwrap an ApiResponse, throwing the client-safe error message on failure.
 * Useful inside Server Components after calling a server action.
 */
export function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}
