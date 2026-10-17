import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupabaseEnv } from "./lib/supabase/env";
import { getMaintenanceMode, isCachedAdministrator } from "./lib/system-settings";

/**
 * Next.js 16 proxy (replaces middleware). Runs on the nodejs runtime.
 *
 * Two jobs:
 *  1. Refresh the Supabase auth session on every request so server-rendered
 *     pages and route handlers always see a fresh user.
 *  2. Maintenance-mode gating: when `system_settings.maintenance_mode` is on,
 *     non-admin requests to /app/*, /admin/* and /register are redirected to
 *     /maintenance. Public auth flows keep working so users can still verify
 *     email or recover their password.
 *
 * Env-safe: when Supabase env vars are absent, both jobs are skipped and the
 * request passes through untouched — the build must never crash on missing
 * configuration (feature pages render the setup-required page).
 *
 * Fail-open: any failure reading settings or roles (missing service-role
 * key, DB error) disables the gate rather than locking everyone out.
 * Settings and roles are cached in-memory for 60s (never read per request).
 */

// Paths that stay reachable for everyone while maintenance mode is on.
// Everything else (/app/*, /admin/*, /register, …) redirects to /maintenance
// unless the requester is an administrator.
const MAINTENANCE_PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/privacy",
  "/terms",
  "/maintenance",
]);

function isPublicDuringMaintenance(pathname: string): boolean {
  if (MAINTENANCE_PUBLIC_PATHS.has(pathname)) return true;
  // Safety net for asset-like paths the matcher did not exclude.
  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/images/")
  ) {
    return true;
  }
  return false;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const env = getPublicSupabaseEnv();
  if (!env) {
    // Supabase not configured — skip auth refresh and the maintenance gate;
    // pages render the honest setup-required UI instead of crashing.
    return response;
  }

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() validates the JWT and refreshes the session when needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // --- Maintenance-mode gate (fail-open, 60s cached reads) ---
  try {
    const maintenance = await getMaintenanceMode();
    if (maintenance) {
      const pathname = request.nextUrl.pathname;
      if (!isPublicDuringMaintenance(pathname)) {
        const admin = user ? await isCachedAdministrator(user.id) : false;
        if (!admin) {
          const url = request.nextUrl.clone();
          url.pathname = "/maintenance";
          url.search = "";
          const redirectResponse = NextResponse.redirect(url);
          // Preserve any session-refresh cookies written above.
          for (const cookie of response.cookies.getAll()) {
            redirectResponse.cookies.set(cookie.name, cookie.value, {
              path: cookie.path,
              maxAge: cookie.maxAge,
              expires: cookie.expires,
              httpOnly: cookie.httpOnly,
              secure: cookie.secure,
              sameSite: cookie.sameSite,
            });
          }
          return redirectResponse;
        }
      }
    }
  } catch (error) {
    // Fail open: a gate failure must never lock everyone out.
    console.error("[aidify] maintenance gate failed open:", error);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and image optimization:
     * https://nextjs.org/docs/app/building-your-application/routing/proxy#matching-paths
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
