/**
 * Foundation smoke tests: safe-redirect, rate-limit, api-response, validators.
 * Wave 4 (agent H) owns the full test suite; these verify the tooling works.
 */
import { describe, expect, it, beforeEach } from "vitest";
import { getSafeRedirect } from "@/lib/safe-redirect";
import {
  checkRateLimit,
  resetRateLimits,
  getClientIp,
} from "@/lib/rate-limit";
import { ok, err, fromUnknownError, ApiErrorCode } from "@/lib/api-response";
import { emailSchema, passwordSchema, slugSchema, loginSchema } from "@/lib/validators";
import { AidifySetupError, isSupabaseConfigured } from "@/lib/supabase/env";

describe("getSafeRedirect", () => {
  it("allows same-origin relative paths", () => {
    expect(getSafeRedirect("/app/configs")).toBe("/app/configs");
    expect(getSafeRedirect("/login?next=/app")).toBe("/login?next=/app");
  });
  it("blocks open redirects", () => {
    expect(getSafeRedirect("https://evil.com")).toBe("/app");
    expect(getSafeRedirect("//evil.com/path")).toBe("/app");
    expect(getSafeRedirect("javascript:alert(1)")).toBe("/app");
    expect(getSafeRedirect("\\evil.com")).toBe("/app");
    expect(getSafeRedirect(null)).toBe("/app");
    expect(getSafeRedirect("", "/login")).toBe("/login");
  });
});

describe("checkRateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("allows up to the limit, then denies", () => {
    const config = { limit: 3, windowMs: 60_000 };
    expect(checkRateLimit("k1", config).allowed).toBe(true);
    expect(checkRateLimit("k1", config).allowed).toBe(true);
    const third = checkRateLimit("k1", config);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
    const fourth = checkRateLimit("k1", config);
    expect(fourth.allowed).toBe(false);
    expect(fourth.retryAfterMs).toBeGreaterThan(0);
  });

  it("isolates buckets per key", () => {
    const config = { limit: 1, windowMs: 60_000 };
    expect(checkRateLimit("a", config).allowed).toBe(true);
    expect(checkRateLimit("b", config).allowed).toBe(true);
    expect(checkRateLimit("a", config).allowed).toBe(false);
  });
});

describe("getClientIp", () => {
  it("prefers x-forwarded-for", () => {
    const req = new Request("http://x/", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });
  it("falls back to unknown", () => {
    expect(getClientIp(new Request("http://x/"))).toBe("unknown");
  });
});

describe("api-response", () => {
  it("builds success and failure envelopes", () => {
    expect(ok({ a: 1 })).toEqual({ ok: true, data: { a: 1 } });
    expect(err("NOT_FOUND", "Missing")).toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: "Missing" },
    });
  });
  it("maps AidifySetupError to NOT_CONFIGURED without leaking details", () => {
    const res = fromUnknownError(new AidifySetupError("Set the keys."));
    expect(res).toEqual({
      ok: false,
      error: { code: ApiErrorCode.NOT_CONFIGURED, message: "Set the keys." },
    });
  });
  it("maps unknown errors to a generic INTERNAL message", () => {
    const res = fromUnknownError(new Error("db password=secret exploded"));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe(ApiErrorCode.INTERNAL);
      expect(res.error.message).not.toContain("secret");
    }
  });
});

describe("validators", () => {
  it("accepts valid emails, rejects the rest", () => {
    expect(emailSchema.safeParse("ava@example.com").success).toBe(true);
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
    expect(emailSchema.parse("  AVA@Example.COM  ")).toBe("ava@example.com");
  });
  it("enforces password length", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("long-enough-1").success).toBe(true);
  });
  it("enforces slug shape", () => {
    expect(slugSchema.safeParse("my-config-1").success).toBe(true);
    expect(slugSchema.safeParse("Bad Slug!").success).toBe(false);
  });
  it("validates the login shape", () => {
    expect(
      loginSchema.safeParse({ email: "a@b.co", password: "x" }).success,
    ).toBe(true);
    expect(loginSchema.safeParse({ email: "a@b.co" }).success).toBe(false);
  });
});

describe("supabase env helpers", () => {
  it("reports unconfigured when env vars are absent", () => {
    expect(isSupabaseConfigured()).toBe(false);
  });
});
