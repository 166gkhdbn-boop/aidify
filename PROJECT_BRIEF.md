# Aidify — Build Coordination Brief

**Project:** Aidify — Advanced Configuration Management Platform (NOT a VPS tool; no SSH/terminal/server-reboot features)
**Working dir:** `~/workspace/aidify/` (Next.js 16.4.2 + React 19.3 + Tailwind v4 scaffold exists)
**Owner:** Ava. Language of UI: English. Tone of any dev-facing text: precise.

## NON-NEGOTIABLE RULES
1. **No emojis anywhere in the UI.** Lucide SVG icons only.
2. **No fake data, no fake auth, no dead buttons, no TODOs for major features.** Every metric must come from real DB queries; when a metric has not been collected, render an honest "Not available" empty state. Every button must do something real.
3. **No real credentials in source code, ever.** `.env.example` has placeholders only. Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public), `SUPABASE_SERVICE_ROLE_KEY` (server-only, never imported in client bundles). If env is missing at runtime, render a clear setup page — never pretend auth works.
4. **Next.js 16 breaking changes** (read `node_modules/next/dist/docs/` before coding; the scaffold `AGENTS.md` says the same):
   - `middleware.ts` is deprecated → use `proxy.ts` with `export function proxy(request: Request)` (nodejs runtime, NOT edge; keep `middleware.ts` only if edge runtime is needed). Supabase session refresh via `@supabase/ssr` works in `proxy.ts`.
   - Async request APIs: `await cookies()`, `await headers()`, `params` is a Promise in dynamic routes.
   - `next lint` removed — run `eslint` separately. Scripts must include `lint`, `typecheck` (`tsc --noEmit`), `test` (vitest).
   - All code you write must build with `next build` on Node 20+.
5. **Visual bar is extremely high.** Read `~/workspace/custom-skills/design/SKILL.md` and `~/workspace/custom-skills/ui-styling/SKILL.md` before building UI. Art direction: reference images `~/workspace/user/files/31353_0_2d0w.png` (primary), `31353_0_3a6h.png`, `31353_1_l8hp.png` — dark glass panels floating above a deep-space cosmic scene (luminous Earth, blue/violet nebulae, crystalline asteroids, reflective liquid foreground). Floating glass aesthetic: thin translucent borders, inner highlight, soft blue/violet glow, backdrop blur.
6. **Strict TypeScript** (`strict: true`, no `any` leaks in public APIs). Zod validates every external input. Never trust client-supplied `owner_id`, `role`, or permissions — derive identity from the verified session server-side.
7. **Supabase project is NOT chosen yet** — write migrations as plain SQL files under `supabase/migrations/`, write code against env vars. Do NOT attempt `supabase db push` or contact any live project. Do NOT use the existing `rdcnkkhqangukrgfehdj` project unless explicitly told.
8. **Do NOT `git push` anywhere** (no remote chosen). Local commits are fine but do not push.
9. Keep business logic out of components (put it in `lib/`). Reusable components, no giant files.
10. shadcn-style accessible primitives (hand-rolled Radix-free is fine if Radix is not installed; prefer installing `radix-ui`? No — do NOT add new deps beyond the coordinator's pinned list without asking. Build accessible primitives with plain HTML+ARIA+Tailwind).

## DESIGN TOKENS (exact)
- bg `#03050D`, deep navy `#071126`, panel `rgba(5,14,35,0.78)`
- primary blue `#438BFF`, electric cyan `#65DFFF`, violet `#8A5CFF`
- text `#F1F6FF`, secondary text `#9BAFCE`
- success `#35D6A0`, warning `#FFCB70`, error `#FF647C`
- Tailwind v4 CSS-first: define in `app/globals.css` with `@theme`.

## ROUTES
Public: `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/privacy`, `/terms`
User app (layout `app/(app)` or `app/app`): `/app`, `/app/configs`, `/app/configs/new`, `/app/configs/[id]`, `/app/configs/[id]/edit`, `/app/collections`, `/app/analytics`, `/app/activity`, `/app/notifications`, `/app/profile`, `/app/security`, `/app/settings`, `/app/support`
Admin (separate layout, server-side authz on EVERY page + every action): `/admin`, `/admin/users`, `/admin/users/[id]`, `/admin/configs`, `/admin/collections`, `/admin/analytics`, `/admin/audit-logs`, `/admin/roles`, `/admin/permissions`, `/admin/reports`, `/admin/support`, `/admin/announcements`, `/admin/system`, `/admin/settings`

## DATABASE (brief §12; exact table list)
profiles(id uuid PK=auth.users.id, username unique, display_name, avatar_url, created_at, updated_at)
roles(id, name unique, description)
user_roles(user_id, role_id, assigned_by, created_at; PK(user_id,role_id))
permissions(id, name unique, description)
role_permissions(role_id, permission_id; PK)
projects(id uuid, owner_id, name, description, created_at, updated_at)
collections(id uuid, owner_id, project_id nullable, name, description, color, icon, archived_at nullable, created_at, updated_at)
configurations(id uuid, owner_id, project_id nullable, collection_id nullable, name, description, config_type, environment, data JSONB default '{}', status check in ('active','archived','draft'), version int default 1, expires_at nullable, notes nullable, created_at, updated_at)
configuration_versions(id uuid, configuration_id FK cascade, version_number, data JSONB, change_summary nullable, changed_by, created_at; unique(configuration_id, version_number))
configuration_tags(id uuid, owner_id, name, unique(owner_id,name), created_at)
configuration_tag_assignments(configuration_id, tag_id; PK)
activity_logs(id uuid, actor_id, action, resource_type, resource_id nullable, metadata JSONB, created_at)
audit_logs(id uuid, actor_id, action, target_type, target_id nullable, reason nullable, metadata JSONB, created_at) — append-only
notifications(id uuid, user_id, title, body, link nullable, read_at nullable, created_at)
support_tickets(id uuid, user_id, subject, description, status check('open','in_progress','resolved','closed'), priority check('low','medium','high','urgent'), created_at, updated_at)
support_ticket_replies(id uuid, ticket_id FK cascade, author_id, body, is_staff bool, created_at)
system_settings(key text PK, value JSONB, updated_by nullable, updated_at)
security_events(id uuid, user_id nullable, event_type, ip nullable, user_agent nullable, metadata JSONB, created_at)
announcements(id uuid, title, body, audience check('all','users','admins'), published bool, created_by, created_at, updated_at)

Roles: `user`, `moderator`, `administrator`. Permissions (suggested): `configs.read`, `configs.create`, `configs.update.own`, `configs.delete.own`, `collections.manage`, `analytics.view`, `content.moderate`, `users.manage`, `roles.manage`, `settings.manage`, `audit.view`.
RLS: enabled on every data table. Owner-only SELECT/INSERT/UPDATE/DELETE for user tables (owner_id = auth.uid()). Roles/user_roles/permissions/system_settings/audit_logs: readable only by administrators (or service role); writes via service-role server actions only. profiles: user can read/update own; admins can read all. Prevent ID-guessing leaks: all policies compare against `auth.uid()`.

## AUTH REQUIREMENTS (§05)
Real Supabase Auth: email+password register/login/logout, email verification, password reset, secure server-side sessions + refresh, profile, account deletion workflow, active-session info (from auth), security event history (our table), rate limiting on auth endpoints, open-redirect protection (validate `next` params are same-origin relative paths), honest error messages.

## CONFIG CORE (§07/§08)
Fields: name, description, type (application|api-endpoints|feature-flags|integration|web-profile|environment|custom-json), environment (development|staging|production|custom), project, collection, tags, JSON data, version, dates, owner, status, expires_at, notes.
Features: CRUD, duplicate, archive/restore, delete w/ confirm, search/filter/sort/paginate (server-side), export/import JSON (server-validated, never silent overwrite → conflict dialog: rename/skip/replace), JSON syntax-highlighted viewer + editor, versioning: every successful update inserts a version snapshot (config id, version number, data, author, timestamp, change summary) in a transaction; restore creates a NEW version; diff view between versions; who/when per change; bulk actions (archive/delete/export).

## ADMIN (§10/§11)
Separate layout + nav. Server-side authorization on every page/action (check admin role via service-role client; never trust browser). Overview: real metrics (users total/new over time, active accounts by activity rule e.g. logged in last 30d — from activity_logs/security_events, configs total + creation trend, failed auth events from security_events, recent admin actions from audit_logs). Storage metric: honest — measure sum of bytea lengths? We don't have a files table; either compute from storage API if feasible or show "Not available". Users: search/filter/detail/suspend (ban via Supabase Admin API)/reactivate/roles (no self-grant, audited)/recovery (send reset). Configs moderation: inspect ownership/metadata, archive/remove with recorded reason. System page: app health checks (DB connectivity, auth service), recent app errors (from a small error_logs table? — add `app_errors(id, message, context jsonb, created_at)` writable by service role only), operational warnings. Audit logs: append-only, admin-viewable. Settings that ACTUALLY work: site_name, maintenance_mode (blocks non-admin access when on), registration_open (blocks /register when off), support_email, max_configs_per_user, announcement banner. Roles/permissions: manage role assignments + permission grants, audited, never allow self-escalation. Announcements CRUD. Support queue: list/reply/status.

## ANALYTICS (§16)
Recharts, real data only, date-range filters, graceful empty states. Charts: configs created over time, activity over time, status distribution, type distribution, (admin) new users over time.

## TESTING (§20)
vitest unit tests for: zod schemas, permission checks, version-restore logic, JSON diff util, import-conflict logic. `supabase/tests/` or docs: RLS test strategy + a SQL test script that verifies owner isolation and admin-only access using two test users (documented, runnable when a project is linked). Integration tests for version writes only if feasible without a live DB — otherwise the SQL script covers it. NEVER claim tests passed unless executed.

## DELIVERABLES (§21) — all of them, incl. README with install, Supabase setup, migration instructions, admin bootstrap procedure (SQL snippet granting administrator to a chosen user id — NO hardcoded credentials), Vercel deployment, known limitations, security checklist.

## WAVE PLAN (coordination)
- Wave 1: A Foundation (deps, tokens, supabase clients, proxy.ts, ui primitives, env.example) + B Database (migrations SQL) — INDEPENDENT, run in parallel.
- Wave 2: C Auth routes + D CosmicBackground 3D + G API/server-actions layer — depend on A (and G needs B's schema).
- Wave 3: E User app + F Admin app — depend on A/B/C/G.
- Wave 4: H Tests + docs + full build/lint/typecheck/test verification.
Each agent: read this brief first, do NOT modify other agents' lanes, keep interfaces stable:
- Supabase browser client: `lib/supabase/client.ts`; server client: `lib/supabase/server.ts` (uses @supabase/ssr, reads env); admin/service client: `lib/supabase/admin.ts` (server-only, throws if key missing).
- Auth helpers: `lib/auth.ts` → `getSessionUser()`, `requireUser()`, `requireRole('administrator'|'moderator')`.
- Rate limit helper: `lib/rate-limit.ts` (in-memory token bucket, per-IP).
- Validation: `lib/validators.ts` (zod schemas) — extend as needed, keep names stable.
- Response envelope: `lib/api-response.ts` → `{ ok: true, data } | { ok: false, error: { code, message } }`.
- UI primitives: `components/ui/*` (button, input, card→`glass-panel`, dialog, dropdown-menu, table→`data-table`, badge, skeleton, toast via simple context, tabs, textarea, select, switch, avatar).
- Layout shells: `components/layout/app-shell.tsx` (sidebar+topbar), `components/layout/admin-shell.tsx`.
- 3D: `components/cosmic-background.tsx` default export, lazy `next/dynamic` ssr:false, props `{ variant?: 'full'|'subtle', className? }`.
- Design tokens: CSS vars in `app/globals.css` (`--aidify-*`), Tailwind v4 `@theme` mapping.
