# Aidify — Migration Deployment Runbook (project `proxy-panel` / `rdcnkkhqangukrgfehdj`)

## PRIMARY METHOD — Supabase Dashboard SQL Editor (no PAT needed)

Ava applies the migrations herself:

1. Open the Supabase Dashboard → project `proxy-panel` → **SQL Editor** → **New query**.
2. Paste the entire contents of [`aidify_all_migrations.sql`](./aidify_all_migrations.sql)
   (933 lines: 0001_schema → 0002_rls → 0003_seed → 0004_versioning_helpers → 0005_user_preferences, in order).
3. Press **Run**. Run it **once** — the seed file (0003) is `ON CONFLICT DO NOTHING`, but the
   schema/RLS files use plain `CREATE TABLE`/`CREATE POLICY` and are NOT idempotent; a second
   paste would error on existing objects (harmless, but confusing).
4. Confirm success: the editor reports success with no red errors.

**Safety notes:**
- The bundle is ADDITIVE ONLY. It creates 20 Aidify tables + helpers; it does not touch
  `panel_users`, `panel_settings`, or the `proxy` Edge Function.
- The file contains no psql meta-commands and no CLI-only features — it is plain SQL, safe to paste.
- If the project already has some Aidify tables (partial run), re-running the whole bundle will fail
  on the first existing object; in that case apply only the not-yet-applied numbered files from
  `supabase/migrations/` in order instead.

## Verify (paste each into the SQL Editor after the migration run)

```sql
-- 1. All Aidify tables exist (expect 20 rows)
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN
('profiles','roles','user_roles','permissions','role_permissions','projects','collections',
 'configurations','configuration_versions','configuration_tags','configuration_tag_assignments',
 'activity_logs','audit_logs','notifications','support_tickets','support_ticket_replies',
 'system_settings','security_events','announcements','app_errors')
ORDER BY 1;

-- 2. RLS enabled on every Aidify table (every row: rls_enabled = true)
SELECT t.tablename, c.relrowsecurity AS rls_enabled
FROM pg_tables t JOIN pg_class c ON c.relname = t.tablename
WHERE t.schemaname = 'public'
  AND t.tablename NOT IN ('panel_users','panel_settings')
ORDER BY 1;

-- 3. panel_users / panel_settings untouched (expect both rows present)
SELECT tablename FROM pg_tables WHERE schemaname = 'public'
AND tablename IN ('panel_users','panel_settings');

-- 4. Seed check (expect roles=3, permissions=13, settings=6)
SELECT (SELECT count(*) FROM roles) AS roles,
       (SELECT count(*) FROM permissions) AS permissions,
       (SELECT count(*) FROM system_settings) AS settings;

-- 5. Versioning helpers exist
SELECT proname FROM pg_proc WHERE proname IN ('bump_config_version','restore_config_version');
```

## First admin bootstrap (Ava runs this herself in the SQL Editor)

After registering her Aidify account, run the snippet in [`README.md`](./README.md)
("Secure first-admin bootstrap") substituting her own `auth.users.id`. Verify:

```sql
SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id
WHERE ur.user_id = '<her-uuid>';
-- Expected: administrator
```

## ALTERNATIVE METHOD — Supabase CLI push (only if a PAT becomes available)

Staged (byte-identical to `~/workspace/aidify/supabase/migrations/`) in the already-linked
project dir `~/workspace/proxy-panel/supabase/migrations/`:
`20261017060000_aidify_schema.sql`, `20261017060001_aidify_rls.sql`,
`20261017060002_aidify_seed.sql`, `20261017060003_aidify_versioning_helpers.sql`
(note: `0005_user_preferences.sql` is NOT staged there yet — stage it before pushing).

```bash
export SUPABASE_ACCESS_TOKEN="<fresh-pat-with-access-to-rdcnkkhqangukrgfehdj>"
cd ~/workspace/proxy-panel
cp ~/workspace/aidify/supabase/migrations/0005_user_preferences.sql \
   supabase/migrations/20261017060004_aidify_user_preferences.sql
~/workspace/bin/supabase db push
unset SUPABASE_ACCESS_TOKEN
```

Then run the verification queries above via `supabase db execute` or the SQL Editor.
