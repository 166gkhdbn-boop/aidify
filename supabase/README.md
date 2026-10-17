# Aidify — Supabase

All database work for Aidify lives here. No live Supabase project is linked
yet, so everything is plain SQL files — nothing here contacts a remote
project.

## Layout

```
supabase/
  migrations/
    0001_schema.sql   -- full schema: tables, indexes, triggers
    0002_rls.sql      -- ENABLE ROW LEVEL SECURITY + all policies
    0003_seed.sql     -- roles, permissions, grants, default system settings
  tests/
    rls_smoke.sql     -- documented RLS verification script (run after linking)
```

## Applying migrations

### Option A — Supabase CLI (`supabase db push`)

```bash
cd ~/workspace/aidify
supabase init        # once, if not already initialized
supabase link --project-ref <your-project-ref>
supabase db push
```

Migrations apply in filename order: `0001` -> `0002` -> `0003`.

### Option B — Dashboard SQL editor

If the CLI is not set up, open the Supabase dashboard -> SQL editor and
paste the three files **in order** (`0001`, `0002`, `0003`), running each
completely before the next. `0003` is idempotent (`ON CONFLICT DO NOTHING`)
and safe to re-run.

## Security model (summary)

- Every data table has RLS enabled. Owner tables (`projects`, `collections`,
  `configurations`, `configuration_tags`, `configuration_tag_assignments`,
  `configuration_versions`, `activity_logs`, `notifications`,
  `support_tickets`, `support_ticket_replies`, `security_events`) are
  owner-isolated: every policy compares against `auth.uid()`, never a
  client-supplied id, so UUID guessing leaks nothing.
- RBAC tables (`roles`, `permissions`, `role_permissions`, `user_roles`)
  have **no policies** — deny by default for all app roles. All reads/writes
  go through service-role server actions, so a client can never read or
  grant itself a role. `is_admin()` and `is_config_owner()` are
  `SECURITY DEFINER` helpers that read those tables without RLS recursion.
- `audit_logs`: admin `SELECT` only, no user writes, plus a trigger that
  rejects `UPDATE`/`DELETE` for every role — append-only.
- `system_settings`: admin `SELECT` only; writes via service role. The
  public keys (`site_name`, `registration_open`, `maintenance_mode`,
  announcement banner) are exposed to the app through a service-role server
  action, never direct table access.
- `app_errors`: no policies — service-role only.
- `announcements`: published rows readable by authenticated users with
  audience filtering (`all` / `users` / `admins`); all writes via service
  role.
- `support_ticket_replies`: users can reply on their own tickets, but
  `WITH CHECK (is_staff = false)` makes forging a staff reply impossible.

## RLS test strategy

`tests/rls_smoke.sql` is a runnable script that verifies the policy set
using **two real test accounts**:

1. Register two users via the app (e.g. `test-a@example.com`,
   `test-b@example.com`), grant one of them no special role.
2. In the dashboard SQL editor (or `psql` as the migration owner), run the
   script. It impersonates each user with
   `SET LOCAL role = authenticated;`
   `SELECT set_config('request.jwt.claims', '{"sub":"<uuid>"}', true);`
   which makes `auth.uid()` return that user's id — the documented Supabase
   approach for testing RLS without minting real JWTs.
3. The script asserts: owner isolation (B sees/updates/deletes nothing of
   A's), no ID-guessing leaks, admin-only tables hidden from regular users,
   append-only audit, immutable version snapshots, no self role-grant, no
   `is_staff` forgery, no ticket status changes by owners, audience-filtered
   announcements.
4. Everything runs inside a transaction ending in `ROLLBACK`, so no test
   data persists.

The script has been carefully written but **not executed** — there is no
linked project yet. Run it once after `supabase db push`.

## First-admin bootstrap (one-time, operator-run)

After registering your own account in the app and verifying the email:

1. Find your user id in the SQL editor:

   ```sql
   select id, email from auth.users where email = 'you@example.com';
   ```

2. Grant yourself the administrator role (replace `YOUR-USER-UUID` with the
   id from step 1 — paste it twice):

   ```sql
   insert into public.user_roles (user_id, role_id, assigned_by)
   select 'YOUR-USER-UUID', r.id, 'YOUR-USER-UUID'
   from public.roles r
   where r.name = 'administrator'
   on conflict do nothing;
   ```

3. Verify:

   ```sql
   select r.name as role
   from public.user_roles ur
   join public.roles r on r.id = ur.role_id
   where ur.user_id = 'YOUR-USER-UUID';
   ```

4. (Optional) revoke again later with:

   ```sql
   delete from public.user_roles
   where user_id = 'YOUR-USER-UUID'
     and role_id = (select id from public.roles where name = 'administrator');
   ```

Warnings:

- Run this in the Supabase **SQL editor** (it runs as the project owner and
  bypasses RLS, which is exactly why the RBAC tables are safe from app
  clients).
- There are **no passwords or secrets** in this repo or in this procedure —
  authentication stays in Supabase Auth; this only assigns a role row.
- Never commit a real UUID to the repo. The snippet above contains only a
  placeholder.
- This is a one-time grant, so there is nothing to "revoke after use"
  operationally — but keep the number of administrators minimal and audit
  the assignment (a row in `audit_logs` is recommended; the app's role
  management writes one automatically).
- All later role changes should go through the admin UI (`/admin/roles`),
  which enforces "no self-grant / no self-escalation" and audits every
  change.
