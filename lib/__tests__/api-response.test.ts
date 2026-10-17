/**
 * API-response envelope tests: success/failure shapes and error mapping.
 *
 * The envelope is the contract every server action returns; error mapping
 * must NEVER leak internals (stack traces, raw DB messages) to the client.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ok,
  err,
  unwrap,
  fromUnknownError,
  ApiErrorCode,
} from "@/lib/api-response";
import { AidifySetupError } from "@/lib/supabase/env";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ok", () => {
  it("builds the success envelope", () => {
    expect(ok({ id: 1 })).toEqual({ ok: true, data: { id: 1 } });
  });
  it("works with null payloads", () => {
    expect(ok(null)).toEqual({ ok: true, data: null });
  });
});

describe("err", () => {
  it("builds the failure envelope with a stable code and message", () => {
    expect(err(ApiErrorCode.NOT_FOUND, "Not here")).toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: "Not here" },
    });
  });
});

describe("ApiErrorCode", () => {
  it("exposes the documented codes", () => {
    expect(ApiErrorCode).toMatchObject({
      UNAUTHENTICATED: "UNAUTHENTICATED",
      FORBIDDEN: "FORBIDDEN",
      VALIDATION: "VALIDATION",
      NOT_FOUND: "NOT_FOUND",
      CONFLICT: "CONFLICT",
      RATE_LIMITED: "RATE_LIMITED",
      NOT_CONFIGURED: "NOT_CONFIGURED",
      INTERNAL: "INTERNAL",
    });
  });
});

describe("fromUnknownError", () => {
  it("maps AidifySetupError to NOT_CONFIGURED with its message", () => {
    const res = fromUnknownError(new AidifySetupError("Supabase is not set up"));
    expect(res).toEqual({
      ok: false,
      error: { code: "NOT_CONFIGURED", message: "Supabase is not set up" },
    });
  });
  it("maps a generic Error to INTERNAL with a fixed message", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = fromUnknownError(new Error("secret: db password=hunter2"));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("INTERNAL");
      expect(res.error.message).toBe(
        "Something went wrong. Please try again later.",
      );
      // The raw error message must never reach the client.
      expect(res.error.message).not.toContain("hunter2");
      expect(JSON.stringify(res)).not.toContain("hunter2");
      expect(JSON.stringify(res)).not.toContain("stack");
    }
  });
  it("maps non-Error values to the same generic INTERNAL response", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = fromUnknownError("raw database connection string");
    expect(res).toEqual({
      ok: false,
      error: {
        code: "INTERNAL",
        message: "Something went wrong. Please try again later.",
      },
    });
  });
});

describe("unwrap", () => {
  it("returns data on success", () => {
    expect(unwrap(ok(42))).toBe(42);
  });
  it("throws the client-safe message on failure", () => {
    expect(() => unwrap(err("NOT_FOUND", "Missing"))).toThrow("Missing");
  });
});
