-- =============================================================================
-- Aidify — RLS smoke test
-- =============================================================================
-- STATUS: WRITTEN, NOT EXECUTED. There is no linked Supabase project yet, so
-- this script has not been run against a live database. It was carefully
-- reviewed for syntax and policy coverage instead.
--
-- HOW TO RUN (once a project is linked and migrations 0001-0003 applied):
--   1. Register two test users through the app, e.g.
--        USER_A = test-a@example.com   (plain "user" role)
--        USER_B = test-b@example.com   (plain "user" role)
--      Look up their UUIDs:
--        select id, email from auth.users where email in
--          ('test-a@example.com', 'test-b@example.com');
--   2. Paste the two UUIDs into the USER_A / USER_B placeholders below.
--   3. Run this whole file in the Supabase dashboard SQL editor (it runs as
--      the project owner, so setup/teardown bypass RLS while the
--      impersonated sections are constrained by it).
--   4. Every section ends with an assertion query. Expected results are
--      noted in comments. Any deviation means a policy is wrong.
--
-- HOW IMPERSONATION WORKS:
--   Supabase's auth.uid() reads the JWT claim "sub". In the SQL editor we
--   fake a session with:
--     set local role = authenticated;
--     select set_config('request.jwt.claims', '{"sub":"<uuid>"}', true);
--   This is the documented Supabase approach for testing RLS without
--   minting real JWTs. `set_config(..., true)` makes the setting local to
--   the current transaction; combined with `set local role`, RLS applies
--   exactly as it would for that user over the API.
--
--   Everything below runs inside one transaction that ends in ROLLBACK,
--   so no test rows persist.
-- =============================================================================

begin;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>> FILL THESE IN <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
-- \set is psql syntax; the SQL editor does not support it, so plain
-- substitution: replace every occurrence of the placeholders with the UUIDs.
--
--   USER_A_UUID  -> uuid of test-a@example.com
--   USER_B_UUID  -> uuid of test-b@example.com
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- ===========================================================================
-- 0. Setup (runs as owner, bypasses RLS): seed rows owned by USER_A
-- ===========================================================================
-- NOTE: configuration rows reference projects/collections; keep ids handy.
insert into public.projects (id, owner_id, name)
values ('a0000000-0000-0000-0000-000000000001', 'USER_A_UUID', 'A project')
on conflict (id) do nothing;

insert into public.configurations
  (id, owner_id, name, config_type, environment, data, status)
values
  ('a0000000-0000-0000-0000-000000000002', 'USER_A_UUID',
   'A config', 'application', 'production', '{"k":"v"}', 'active')
on conflict (id) do nothing;

insert into public.configuration_versions
  (configuration_id, version_number, data, change_summary)
values
  ('a0000000-0000-0000-0000-000000000002', 1, '{"k":"v"}', 'initial')
on conflict do nothing;

insert into public.support_tickets (id, user_id, subject, status)
values ('a0000000-0000-0000-0000-000000000003', 'USER_A_UUID',
        'A ticket', 'open')
on conflict (id) do nothing;

insert into public.announcements (id, title, body, audience, published)
values
  ('a0000000-0000-0000-0000-000000000004', 'Public note', 'hi', 'all', true),
  ('a0000000-0000-0000-0000-000000000005', 'Draft note', 'shh', 'all', false),
  ('a0000000-0000-0000-0000-000000000006', 'Admins only', 'hi', 'admins', true)
on conflict (id) do nothing;

-- ===========================================================================
-- Helper: impersonate a user for the rest of the transaction segment.
-- (Re-run the two lines with the other UUID to switch users.)
-- ===========================================================================
-- set local role = authenticated;
-- select set_config('request.jwt.claims', '{"sub":"USER_A_UUID"}', true);

-- ===========================================================================
-- A. Owner isolation — USER_B must see nothing of USER_A
--    (impersonate USER_B first)
-- ===========================================================================
-- EXPECT: 0 rows each (no ID-guessing leak via direct UUID select)
-- select count(*) from public.projects
--   where id = 'a0000000-0000-0000-0000-000000000001';
-- select count(*) from public.configurations
--   where id = 'a0000000-0000-0000-0000-000000000002';
-- select count(*) from public.configuration_versions
--   where configuration_id = 'a0000000-0000-0000-0000-000000000002';

-- EXPECT: 0 rows updated / 0 rows deleted (RLS silently filters)
-- update public.configurations set name = 'hijacked'
--   where id = 'a0000000-0000-0000-0000-000000000002';
-- delete from public.projects
--   where id = 'a0000000-0000-0000-0000-000000000001';

-- EXPECT: B can create their OWN rows
-- insert into public.projects (owner_id, name)
--   values ('USER_B_UUID', 'B project') returning id;

-- EXPECT: B cannot forge ownership of A (0 rows inserted -> check violation)
-- insert into public.projects (owner_id, name)
--   values ('USER_A_UUID', 'forged');

-- ===========================================================================
-- B. Owner can manage own rows (impersonate USER_A)
-- ===========================================================================
-- EXPECT: 1 row each
-- select count(*) from public.configurations
--   where id = 'a0000000-0000-0000-0000-000000000002';
-- EXPECT: 1 row updated
-- update public.configurations set description = 'edited by owner'
--   where id = 'a0000000-0000-0000-0000-000000000002';

-- Tag assignment allowed only via owned parent config:
-- insert into public.configuration_tags (owner_id, name)
--   values ('USER_A_UUID', 'smoke') returning id;   -- keep the id as TAG_ID
-- insert into public.configuration_tag_assignments (configuration_id, tag_id)
--   values ('a0000000-0000-0000-0000-000000000002', 'TAG_ID');
-- (impersonate USER_B) EXPECT: 0 rows — B cannot attach to A's config
-- select count(*) from public.configuration_tag_assignments
--   where configuration_id = 'a0000000-0000-0000-0000-000000000002';

-- ===========================================================================
-- C. Admin-only tables hidden from regular users (impersonate USER_B)
-- ===========================================================================
-- EXPECT: 0 rows each
-- select count(*) from public.roles;
-- select count(*) from public.permissions;
-- select count(*) from public.user_roles;
-- select count(*) from public.audit_logs;
-- select count(*) from public.system_settings;
-- select count(*) from public.app_errors;

-- EXPECT: 0 rows inserted (no INSERT policy -> denied)
-- insert into public.user_roles (user_id, role_id)
--   select 'USER_B_UUID', id from public.roles where name = 'administrator';

-- ===========================================================================
-- D. Append-only audit (impersonate USER_A; then as owner for the trigger)
-- ===========================================================================
-- As USER_A: EXPECT 0 rows — cannot even UPDATE own-triggered rows
-- update public.audit_logs set reason = 'tampered'
--   where actor_id = 'USER_A_UUID';
-- As owner (reset role; outside impersonation): the trigger must raise.
--   reset role;
--   update public.audit_logs set reason = 'x' where id = '<any id>';
-- EXPECT: ERROR "audit_logs is append-only: UPDATE is not allowed"

-- ===========================================================================
-- E. Version snapshots immutable (impersonate USER_A)
-- ===========================================================================
-- EXPECT: 1 row selected, 0 rows updated, 0 rows deleted
-- select count(*) from public.configuration_versions
--   where configuration_id = 'a0000000-0000-0000-0000-000000000002';
-- update public.configuration_versions set data = '{"evil":true}'
--   where configuration_id = 'a0000000-0000-0000-0000-000000000002';
-- delete from public.configuration_versions
--   where configuration_id = 'a0000000-0000-0000-0000-000000000002';

-- ===========================================================================
-- F. Support tickets (impersonate USER_A)
-- ===========================================================================
-- EXPECT: owner sees own ticket
-- select count(*) from public.support_tickets
--   where id = 'a0000000-0000-0000-0000-000000000003';
-- EXPECT: 0 rows — owner cannot close own ticket via direct SQL
-- update public.support_tickets set status = 'closed'
--   where id = 'a0000000-0000-0000-0000-000000000003';
-- (impersonate USER_B) EXPECT: 0 rows — B sees none of A's tickets
-- select count(*) from public.support_tickets
--   where id = 'a0000000-0000-0000-0000-000000000003';

-- Replies: owner may reply, but is_staff forgery is blocked
-- (impersonate USER_A)
-- insert into public.support_ticket_replies
--   (ticket_id, author_id, body, is_staff)
--   values ('a0000000-0000-0000-0000-000000000003', 'USER_A_UUID',
--           'hello', true);
-- EXPECT: ERROR (new row violates row-level security policy)
-- insert into public.support_ticket_replies
--   (ticket_id, author_id, body)
--   values ('a0000000-0000-0000-0000-000000000003', 'USER_A_UUID',
--           'hello');
-- EXPECT: 1 row inserted

-- ===========================================================================
-- G. Announcements audience filter (impersonate USER_A, a non-admin)
-- ===========================================================================
-- EXPECT: exactly the 1 published 'all' announcement
-- select id from public.announcements;
-- (After bootstrapping USER_A as administrator, re-run: EXPECT 2 rows —
--  the 'all' one plus the published 'admins' one; the unpublished draft
--  stays invisible to everyone.)

-- ===========================================================================
-- H. Security events + notifications self-read (impersonate USER_A)
-- ===========================================================================
-- insert into public.security_events (user_id, event_type, ip)
--   values ('USER_A_UUID', 'login.failed', '127.0.0.1');
-- EXPECT: ERROR — no user INSERT policy (service role only)
-- select count(*) from public.security_events
--   where user_id = 'USER_A_UUID';
-- EXPECT: 1 row

-- ===========================================================================
-- I. Admin positive control (bootstrap USER_A as administrator per
--    supabase/README.md, then impersonate USER_A)
-- ===========================================================================
-- EXPECT: 3 rows (all roles), settings visible, audit visible
-- select count(*) from public.roles;
-- select count(*) from public.system_settings;
-- select count(*) from public.audit_logs;
-- EXPECT: own profile readable AND other profiles readable via is_admin()
-- select count(*) from public.profiles;

-- ===========================================================================
-- Teardown: roll back everything (no test data persists)
-- ===========================================================================
rollback;
