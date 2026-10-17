import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSafeRedirect } from "@/lib/safe-redirect";
import { logSecurityEvent } from "@/lib/security-events";
import { ensureProfile } from "@/lib/profile";

/**
 * GET /auth/callback — completes email verification / OAuth-style PKCE flows.
 *
 * - `?code=…` is exchanged for a session (PKCE).
 * - `next` is validated with open-redirect protection (default /app).
 * - `error`/`error_description` from Supabase become a human message shown
 *   on /login via the `auth_error` param.
 * - Ensures the `profiles` row exists and logs `email_verified`/`login_success`.
 */

const EMAIL_CONFIRMED_RECENTLY_MS = 10 * 60 * 1000;

function loginRedirect(request: NextRequest, message: string): NextResponse {
  const url = new URL("/login", request.url);
  url.searchParams.set("auth_error", message);
  return NextResponse.redirect(url);
}

function humanizeError(error: string | null, description: string | null): string {
  if (description && description.trim()) return description.trim();

  switch (error) {
    case "access_denied":
      return "This link was denied or has already been used. Please request a new one.";
    case "expired_token":
    case "invalid_grant":
      return "This verification link has expired. Please request a new one.";
    default:
      return "This link is invalid or has expired. Please request a new one.";
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const next = getSafeRedirect(searchParams.get("next"), "/app");

  // Supabase redirects here with error params when the link itself failed.
  const error = searchParams.get("error");
  if (error) {
    return loginRedirect(
      request,
      humanizeError(error, searchParams.get("error_description")),
    );
  }

  const code = searchParams.get("code");
  if (!code) {
    return loginRedirect(
      request,
      "This link is invalid — it is missing the verification code. Please request a new one.",
    );
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return loginRedirect(
      request,
      "Aidify is not configured yet (missing Supabase keys). The link could not be verified.",
    );
  }

  const { data, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !data.user) {
    return loginRedirect(
      request,
      humanizeError(exchangeError?.code ?? null, exchangeError?.message ?? null),
    );
  }

  const user = data.user;
  const metadataName = user.user_metadata?.["display_name"];
  await ensureProfile({
    id: user.id,
    email: user.email,
    displayName: typeof metadataName === "string" ? metadataName : undefined,
  });

  // Email confirmation: the verify link sets email_confirmed_at right now.
  const confirmedAt = user.email_confirmed_at
    ? Date.parse(user.email_confirmed_at)
    : Number.NaN;
  if (
    !Number.isNaN(confirmedAt) &&
    Date.now() - confirmedAt < EMAIL_CONFIRMED_RECENTLY_MS
  ) {
    await logSecurityEvent({
      eventType: "email_verified",
      userId: user.id,
    });
  }

  await logSecurityEvent({
    eventType: "login_success",
    userId: user.id,
    metadata: { via: "email_callback" },
  });

  return NextResponse.redirect(new URL(next, request.url));
}
