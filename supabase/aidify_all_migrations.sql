-- Aidify — combined migrations for Supabase Dashboard SQL Editor
-- Generated 2026-10-17. Run ONCE: paste the entire file into SQL Editor > New query > Run.
-- Order: 0001_schema -> 0002_rls -> 0003_seed -> 0004_versioning_helpers -> 0005_user_preferences


-- ================= 0001_schema.sql ================
-- =============================================================================
-- Aidify — Migration 0001: Full schema
-- =============================================================================
-- Creates every data table for the Aidify configuration management platform.
-- Conventions:
--   * All primary keys are UUID via gen_random_uuid().
--   * All *_at columns are timestamptz with DEFAULT now().
--   * Owner-scoped tables carry owner_id -> auth.users(id) ON DELETE CASCADE.
--   * Never trust client-supplied owner_id: RLS (migration 0002) forces
--     owner_id = auth.uid(); server actions derive identity from the session.
-- Run order: 0001_schema -> 0002_rls -> 0003_seed (via `supabase db push`
-- or pasted in order into the Supabase dashboard SQL editor).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Shared trigger helpers
-- ---------------------------------------------------------------------------

-- Keeps updated_at fresh on every UPDATE.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- audit_logs is append-only: block UPDATE and DELETE for EVERY role,
-- including service_role (server actions must only INSERT).
CREATE OR REPLACE FUNCTION public.prevent_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: % is not allowed', TG_OP;
END;
$$;

-- ---------------------------------------------------------------------------
-- profiles — one row per auth.users row (created by server action on signup)
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  username    text NOT NULL UNIQUE CHECK (username ~ '^[a-zA-Z0-9_.-]{3,32}$'),
  display_name text,
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RBAC: roles / permissions / grants. No RLS policies on these (0002) —
-- readable only by administrators; all writes via service-role server actions.
-- ---------------------------------------------------------------------------
CREATE TABLE public.roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role_id     uuid NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);
CREATE INDEX idx_user_roles_role ON public.user_roles (role_id);

CREATE TABLE public.role_permissions (
  role_id       uuid NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions (id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);
CREATE INDEX idx_role_permissions_permission ON public.role_permissions (permission_id);

-- ---------------------------------------------------------------------------
-- projects — top-level owner container
-- ---------------------------------------------------------------------------
CREATE TABLE public.projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_projects_owner ON public.projects (owner_id);
CREATE INDEX idx_projects_created ON public.projects (created_at DESC);
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- collections — groupings inside (or outside) a project
-- ---------------------------------------------------------------------------
CREATE TABLE public.collections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  project_id  uuid REFERENCES public.projects (id) ON DELETE SET NULL,
  name        text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description text,
  color       text,
  icon        text,
  archived_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_collections_owner ON public.collections (owner_id);
CREATE INDEX idx_collections_project ON public.collections (project_id);
CREATE INDEX idx_collections_created ON public.collections (created_at DESC);
CREATE TRIGGER trg_collections_updated_at
  BEFORE UPDATE ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- configurations — the core entity
-- ---------------------------------------------------------------------------
CREATE TABLE public.configurations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  project_id    uuid REFERENCES public.projects (id) ON DELETE SET NULL,
  collection_id uuid REFERENCES public.collections (id) ON DELETE SET NULL,
  name          text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  description   text,
  config_type   text NOT NULL CHECK (config_type IN (
                  'application', 'api-endpoints', 'feature-flags',
                  'integration', 'web-profile', 'environment', 'custom-json'
                )),
  environment   text NOT NULL CHECK (environment IN (
                  'development', 'staging', 'production', 'custom'
                )),
  data          jsonb NOT NULL DEFAULT '{}'::jsonb,
  status        text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('active', 'archived', 'draft')),
  version       integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  expires_at    timestamptz,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_configurations_owner ON public.configurations (owner_id);
CREATE INDEX idx_configurations_project ON public.configurations (project_id);
CREATE INDEX idx_configurations_collection ON public.configurations (collection_id);
CREATE INDEX idx_configurations_created ON public.configurations (created_at DESC);
CREATE INDEX idx_configurations_status ON public.configurations (status);
CREATE TRIGGER trg_configurations_updated_at
  BEFORE UPDATE ON public.configurations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- configuration_versions — immutable snapshots; one per successful update.
-- Written by server actions in the same transaction as the config UPDATE.
-- ---------------------------------------------------------------------------
CREATE TABLE public.configuration_versions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_id uuid NOT NULL REFERENCES public.configurations (id) ON DELETE CASCADE,
  version_number   integer NOT NULL CHECK (version_number >= 1),
  data             jsonb NOT NULL DEFAULT '{}'::jsonb,
  change_summary   text,
  changed_by       uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (configuration_id, version_number)
);
-- The UNIQUE constraint already backs lookups on (configuration_id, version_number);
-- this extra index serves version-list ordering.
CREATE INDEX idx_config_versions_list
  ON public.configuration_versions (configuration_id, version_number DESC);
CREATE INDEX idx_config_versions_created
  ON public.configuration_versions (created_at DESC);

-- ---------------------------------------------------------------------------
-- configuration_tags + assignments
-- ---------------------------------------------------------------------------
CREATE TABLE public.configuration_tags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, name)
);
CREATE INDEX idx_config_tags_owner ON public.configuration_tags (owner_id);

CREATE TABLE public.configuration_tag_assignments (
  configuration_id uuid NOT NULL REFERENCES public.configurations (id) ON DELETE CASCADE,
  tag_id           uuid NOT NULL REFERENCES public.configuration_tags (id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (configuration_id, tag_id)
);
CREATE INDEX idx_tag_assignments_tag ON public.configuration_tag_assignments (tag_id);

-- ---------------------------------------------------------------------------
-- activity_logs — per-user action history (immutable; no UPDATE/DELETE policies)
-- ---------------------------------------------------------------------------
CREATE TABLE public.activity_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  action        text NOT NULL,
  resource_type text NOT NULL,
  resource_id   uuid,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_logs_actor ON public.activity_logs (actor_id);
CREATE INDEX idx_activity_logs_created ON public.activity_logs (created_at DESC);

-- ---------------------------------------------------------------------------
-- audit_logs — append-only admin audit trail.
-- No user-facing write policies; a trigger rejects UPDATE/DELETE for all roles.
-- ---------------------------------------------------------------------------
CREATE TABLE public.audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  action      text NOT NULL,
  target_type text NOT NULL,
  target_id   uuid,
  reason      text,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs (actor_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs (created_at DESC);
CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

-- ---------------------------------------------------------------------------
-- notifications — created by server actions (service role); users read/dismiss
-- ---------------------------------------------------------------------------
CREATE TABLE public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title      text NOT NULL,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications (user_id);
CREATE INDEX idx_notifications_created ON public.notifications (created_at DESC);

-- ---------------------------------------------------------------------------
-- support_tickets + replies
-- ---------------------------------------------------------------------------
CREATE TABLE public.support_tickets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  subject     text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 200),
  description text,
  status      text NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority    text NOT NULL DEFAULT 'medium'
                CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_support_tickets_user ON public.support_tickets (user_id);
CREATE INDEX idx_support_tickets_created ON public.support_tickets (created_at DESC);
CREATE INDEX idx_support_tickets_status ON public.support_tickets (status);
CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.support_ticket_replies (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  uuid NOT NULL REFERENCES public.support_tickets (id) ON DELETE CASCADE,
  author_id  uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  body       text NOT NULL,
  is_staff   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_replies_ticket ON public.support_ticket_replies (ticket_id);
CREATE INDEX idx_ticket_replies_created ON public.support_ticket_replies (created_at);

-- ---------------------------------------------------------------------------
-- system_settings — key/value store. Admin-read via RLS; all writes via
-- service-role server actions. A small set of public keys is exposed to the
-- app through a server action (never direct table access).
-- ---------------------------------------------------------------------------
CREATE TABLE public.system_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL DEFAULT 'null'::jsonb,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- security_events — login failures, suspicious activity, etc.
-- Written by server actions (service role); users read their own history.
-- ---------------------------------------------------------------------------
CREATE TABLE public.security_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  event_type text NOT NULL,
  ip         text,
  user_agent text,
  metadata   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_security_events_user ON public.security_events (user_id);
CREATE INDEX idx_security_events_created ON public.security_events (created_at DESC);
CREATE INDEX idx_security_events_type ON public.security_events (event_type);

-- ---------------------------------------------------------------------------
-- announcements — published ones are readable per audience (see 0002_rls)
-- ---------------------------------------------------------------------------
CREATE TABLE public.announcements (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  body       text NOT NULL,
  audience   text NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'users', 'admins')),
  published  boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_announcements_created ON public.announcements (created_at DESC);
CREATE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- app_errors — service-role only (admin System page reads via service role).
-- ---------------------------------------------------------------------------
CREATE TABLE public.app_errors (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message    text NOT NULL,
  context    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_app_errors_created ON public.app_errors (created_at DESC);

-- ================= 0002_rls.sql ================
-- =============================================================================
-- Aidify — Migration 0002: Row Level Security
-- =============================================================================
-- Enables RLS on every data table and installs the policy set.
--
-- Design rules (see PROJECT_BRIEF.md §12):
--   1. Every policy keys off auth.uid() — never a client-supplied id — so
--      UUID guessing cannot leak another user's rows.
--   2. Owner tables: SELECT/INSERT/UPDATE/DELETE only when the row belongs to
--      the caller. INSERT/UPDATE use WITH CHECK on the same condition.
--   3. RBAC tables (roles, permissions, role_permissions, user_roles):
--      NO policies at all -> denied for every non-service role by default.
--      All reads/writes go through service-role server actions. This keeps
--      role checks unforgeable: the client can never read or grant itself
--      a role.
--   4. Helper functions are SECURITY DEFINER so they can read the RBAC
--      tables without tripping RLS recursion (a policy calling a function
--      that queries a table that has its own policies would recurse).
--   5. audit_logs: SELECT admin-only; no user write policies; the
--      prevent_audit_mutation() trigger from 0001 makes it append-only
--      even for service_role.
--   6. app_errors: no policies — service-role only.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER, caller-safe)
-- ---------------------------------------------------------------------------

-- True when the current session user holds the administrator role.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.name = 'administrator'
  );
$$;

-- True when the current session user owns the given configuration.
-- Used by policies on configuration_versions and
-- configuration_tag_assignments to avoid recursive policy joins.
CREATE OR REPLACE FUNCTION public.is_config_owner(p_config_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.configurations c
    WHERE c.id = p_config_id
      AND c.owner_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_config_owner(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS on every data table
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configurations                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuration_versions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuration_tags          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuration_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_replies        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_errors                    ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- profiles — user reads/updates own row; administrators read all.
-- (Profile rows are created by a service-role server action at signup,
--  so there is no user INSERT policy.)
-- ===========================================================================
CREATE POLICY profiles_select_own_or_admin ON public.profiles
  FOR SELECT
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ===========================================================================
-- RBAC tables — intentionally NO policies: deny-by-default for all app roles.
-- Server actions use the service-role client for every read/write here.
-- ===========================================================================

-- ===========================================================================
-- projects / collections / configurations / configuration_tags — owner-only
-- ===========================================================================
CREATE POLICY projects_select_owner ON public.projects
  FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY projects_insert_owner ON public.projects
  FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY projects_update_owner ON public.projects
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY projects_delete_owner ON public.projects
  FOR DELETE USING (owner_id = auth.uid());

CREATE POLICY collections_select_owner ON public.collections
  FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY collections_insert_owner ON public.collections
  FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY collections_update_owner ON public.collections
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY collections_delete_owner ON public.collections
  FOR DELETE USING (owner_id = auth.uid());

CREATE POLICY configurations_select_owner ON public.configurations
  FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY configurations_insert_owner ON public.configurations
  FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY configurations_update_owner ON public.configurations
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY configurations_delete_owner ON public.configurations
  FOR DELETE USING (owner_id = auth.uid());

CREATE POLICY configuration_tags_select_owner ON public.configuration_tags
  FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY configuration_tags_insert_owner ON public.configuration_tags
  FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY configuration_tags_update_owner ON public.configuration_tags
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY configuration_tags_delete_owner ON public.configuration_tags
  FOR DELETE USING (owner_id = auth.uid());

-- ===========================================================================
-- configuration_versions — visible/writable only via parent ownership.
-- Immutable: SELECT + INSERT for owners, no UPDATE/DELETE policies.
-- (Server actions normally insert snapshots via service role in the same
--  transaction as the config update; this policy covers owner-initiated
--  restores that go through the RLS path.)
-- ===========================================================================
CREATE POLICY configuration_versions_select_owner ON public.configuration_versions
  FOR SELECT USING (public.is_config_owner(configuration_id));
CREATE POLICY configuration_versions_insert_owner ON public.configuration_versions
  FOR INSERT WITH CHECK (public.is_config_owner(configuration_id));

-- ===========================================================================
-- configuration_tag_assignments — allowed when the parent configuration
-- is owned. No UPDATE policy: assignments are (config, tag) pairs; changing
-- one means DELETE + INSERT.
-- ===========================================================================
CREATE POLICY tag_assignments_select_owner ON public.configuration_tag_assignments
  FOR SELECT USING (public.is_config_owner(configuration_id));
CREATE POLICY tag_assignments_insert_owner ON public.configuration_tag_assignments
  FOR INSERT WITH CHECK (public.is_config_owner(configuration_id));
CREATE POLICY tag_assignments_delete_owner ON public.configuration_tag_assignments
  FOR DELETE USING (public.is_config_owner(configuration_id));

-- ===========================================================================
-- activity_logs — actor reads own history; actor may insert own actions.
-- No UPDATE/DELETE: history is immutable for users.
-- ===========================================================================
CREATE POLICY activity_logs_select_actor ON public.activity_logs
  FOR SELECT USING (actor_id = auth.uid());
CREATE POLICY activity_logs_insert_actor ON public.activity_logs
  FOR INSERT WITH CHECK (actor_id = auth.uid());

-- ===========================================================================
-- audit_logs — SELECT admin-only; no user write policies (service role only).
-- Append-only is additionally enforced by the prevent_audit_mutation()
-- trigger from migration 0001.
-- ===========================================================================
CREATE POLICY audit_logs_select_admin ON public.audit_logs
  FOR SELECT USING (public.is_admin());

-- ===========================================================================
-- notifications — owner reads, marks read (UPDATE), and dismisses (DELETE).
-- Creation is service-role only (no user INSERT policy).
-- ===========================================================================
CREATE POLICY notifications_select_owner ON public.notifications
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY notifications_update_owner ON public.notifications
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY notifications_delete_owner ON public.notifications
  FOR DELETE USING (user_id = auth.uid());

-- ===========================================================================
-- support_tickets — owner reads and opens tickets; may edit open/in-progress
-- tickets but cannot change status out of that set (status transitions are
-- staff operations via service-role server actions). No user DELETE.
-- ===========================================================================
CREATE POLICY support_tickets_select_owner ON public.support_tickets
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY support_tickets_insert_owner ON public.support_tickets
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY support_tickets_update_owner ON public.support_tickets
  FOR UPDATE
  USING (user_id = auth.uid() AND status IN ('open', 'in_progress'))
  WITH CHECK (user_id = auth.uid() AND status IN ('open', 'in_progress'));

-- ===========================================================================
-- support_ticket_replies — owner reads replies on own tickets; may reply,
-- but cannot forge staff replies (is_staff is forced false by WITH CHECK;
-- staff replies are written via service-role server actions).
-- ===========================================================================
CREATE POLICY ticket_replies_select_owner ON public.support_ticket_replies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
  );
CREATE POLICY ticket_replies_insert_owner ON public.support_ticket_replies
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND is_staff = false
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
  );

-- ===========================================================================
-- system_settings — admin read only via RLS; all writes via service role.
-- The handful of public keys (site_name, registration_open,
-- maintenance_mode, announcement banner) are exposed to the app through a
-- service-role server action — never through direct table access.
-- ===========================================================================
CREATE POLICY system_settings_select_admin ON public.system_settings
  FOR SELECT USING (public.is_admin());

-- ===========================================================================
-- security_events — user reads own history. Writes are service-role only
-- (server actions log login failures etc. with the real client IP).
-- ===========================================================================
CREATE POLICY security_events_select_owner ON public.security_events
  FOR SELECT USING (user_id = auth.uid());

-- ===========================================================================
-- announcements — published announcements readable by authenticated users
-- with audience filtering: 'all' -> everyone, 'users' -> everyone
-- authenticated, 'admins' -> administrators only. All writes via service role.
-- ===========================================================================
CREATE POLICY announcements_select_published ON public.announcements
  FOR SELECT USING (
    published = true
    AND (
      audience = 'all'
      OR (audience = 'users' AND auth.uid() IS NOT NULL)
      OR (audience = 'admins' AND public.is_admin())
    )
  );

-- ===========================================================================
-- app_errors — intentionally NO policies: service-role only.
-- (Admin System page reads them through a service-role server action.)
-- ===========================================================================

-- ================= 0003_seed.sql ================
-- =============================================================================
-- Aidify — Migration 0003: Seed roles, permissions, and default settings
-- =============================================================================
-- Idempotent: every statement uses ON CONFLICT DO NOTHING, so the migration
-- is safe to re-run.
--
-- NOTE: this migration runs as the migration owner (postgres / service role),
-- which bypasses RLS. The RBAC tables intentionally have no user policies
-- (see 0002_rls.sql); seeding here is the only non-service-role write path.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
INSERT INTO public.roles (name, description) VALUES
  ('user',          'Standard account: manages their own configurations.'),
  ('moderator',     'Support and content moderation: handles tickets and announcements.'),
  ('administrator', 'Full control: users, roles, settings, audit logs.')
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions (name, description) VALUES
  ('configs.read',        'Read configurations (own, via RLS).'),
  ('configs.create',      'Create configurations.'),
  ('configs.update.own',  'Update own configurations.'),
  ('configs.delete.own',  'Delete own configurations.'),
  ('collections.manage',  'Create, edit, archive and delete own collections.'),
  ('analytics.view',      'View personal analytics dashboards.'),
  ('content.moderate',    'Inspect and moderate user configurations.'),
  ('users.manage',        'View and manage user accounts.'),
  ('roles.manage',        'Assign roles and manage role-permission grants.'),
  ('settings.manage',     'Change system settings.'),
  ('audit.view',          'View audit logs.'),
  ('support.manage',      'View and reply to support tickets.'),
  ('announcements.manage','Create, edit and publish announcements.')
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Role -> permission grants
--   administrator: everything
--   moderator:     configs.read, configs.create, configs.update.own,
--                  content.moderate, support.manage, announcements.manage
--   user:          configs.read, configs.create, configs.update.own,
--                  configs.delete.own, collections.manage, analytics.view
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.name IN (
  'configs.read', 'configs.create', 'configs.update.own', 'configs.delete.own',
  'collections.manage', 'analytics.view', 'content.moderate', 'users.manage',
  'roles.manage', 'settings.manage', 'audit.view', 'support.manage',
  'announcements.manage'
)
WHERE r.name = 'administrator'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.name IN (
  'configs.read', 'configs.create', 'configs.update.own',
  'content.moderate', 'support.manage', 'announcements.manage'
)
WHERE r.name = 'moderator'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.name IN (
  'configs.read', 'configs.create', 'configs.update.own', 'configs.delete.own',
  'collections.manage', 'analytics.view'
)
WHERE r.name = 'user'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Default system settings. Values are JSONB; read via the service-role
-- server action `getSystemSettings()`. Only the keys listed in 0002_rls.sql
-- are exposed publicly by that action.
-- ---------------------------------------------------------------------------
INSERT INTO public.system_settings (key, value) VALUES
  ('site_name',            '"Aidify"'),
  ('registration_open',    'true'),
  ('maintenance_mode',     'false'),
  ('support_email',        '""'),
  ('max_configs_per_user', '500'),
  ('announcement_banner',  'null')
ON CONFLICT (key) DO NOTHING;

-- ================= 0004_versioning_helpers.sql ================
-- =============================================================================
-- Aidify — Migration 0004: atomic versioning helpers
-- =============================================================================
-- Two SECURITY DEFINER functions that make config updates atomic:
--
--   public.bump_config_version(p_config_id, p_actor, p_expected_version,
--                              p_data, p_summary, p_fields)
--     Locks the config row, verifies the caller IS the owner and IS the
--     authenticated user (p_actor must equal auth.uid()), enforces
--     optimistic locking (current version must equal p_expected_version),
--     inserts the configuration_versions snapshot of the NEW state with
--     version_number = current + 1, then applies the update. Returns the new
--     version number. Raises VERSION_CONFLICT (SQLSTATE P0001) on a stale
--     expected version so the DAL can map it to a 409-style envelope.
--
--   public.restore_config_version(p_config_id, p_actor, p_version_number,
--                                 p_summary)
--     Reads the snapshot for p_version_number and re-applies it through
--     bump_config_version, so a restore ALWAYS creates a NEW version —
--     history is append-only and never rewritten or destroyed.
--
-- SECURITY MODEL: the functions bypass RLS by design (SECURITY DEFINER),
-- so they re-verify ownership and caller identity manually inside.
-- EXECUTE is granted only to `authenticated`; PUBLIC execute is revoked.
-- The DAL calls these with the anon-key server client so auth.uid() is set.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- bump_config_version
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bump_config_version(
  p_config_id        uuid,
  p_actor            uuid,
  p_expected_version integer,
  p_data             jsonb,
  p_summary          text,
  p_fields           jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id    uuid;
  v_version     integer;
  v_new_version integer;
BEGIN
  -- Abuse guard: the caller must be the authenticated user, acting only on
  -- their own behalf. p_actor is derived server-side from the session.
  IF p_actor IS NULL OR p_actor IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'bump_config_version: actor mismatch'
      USING ERRCODE = '42501';
  END IF;

  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' THEN
    RAISE EXCEPTION 'bump_config_version: data must be a JSON object'
      USING ERRCODE = '22023';
  END IF;

  -- Lock the row for the rest of the transaction.
  SELECT owner_id, version
    INTO v_owner_id, v_version
  FROM public.configurations
  WHERE id = p_config_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'bump_config_version: configuration not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_owner_id IS DISTINCT FROM p_actor THEN
    RAISE EXCEPTION 'bump_config_version: caller is not the owner'
      USING ERRCODE = '42501';
  END IF;

  -- Optimistic concurrency: the caller must have read the current version.
  IF v_version <> p_expected_version THEN
    RAISE EXCEPTION 'VERSION_CONFLICT: expected version %, found %',
      p_expected_version, v_version
      USING ERRCODE = 'P0001';
  END IF;

  v_new_version := v_version + 1;

  -- Snapshot the NEW state (append-only history).
  INSERT INTO public.configuration_versions
    (configuration_id, version_number, data, change_summary, changed_by)
  VALUES
    (p_config_id, v_new_version, p_data, NULLIF(p_summary, ''), p_actor);

  -- Apply the update. Only whitelisted keys are read from p_fields; keys
  -- absent from p_fields keep their current values. Explicit JSON nulls
  -- clear nullable columns.
  UPDATE public.configurations
  SET
    name          = COALESCE(NULLIF(p_fields ->> 'name', ''), name),
    description   = CASE WHEN p_fields ? 'description'
                         THEN NULLIF(p_fields ->> 'description', '')
                         ELSE description END,
    config_type   = COALESCE(NULLIF(p_fields ->> 'config_type', ''), config_type),
    environment   = COALESCE(NULLIF(p_fields ->> 'environment', ''), environment),
    status        = COALESCE(NULLIF(p_fields ->> 'status', ''), status),
    project_id    = CASE WHEN p_fields ? 'project_id'
                         THEN NULLIF(p_fields ->> 'project_id', '')::uuid
                         ELSE project_id END,
    collection_id = CASE WHEN p_fields ? 'collection_id'
                         THEN NULLIF(p_fields ->> 'collection_id', '')::uuid
                         ELSE collection_id END,
    expires_at    = CASE WHEN p_fields ? 'expires_at'
                         THEN NULLIF(p_fields ->> 'expires_at', '')::timestamptz
                         ELSE expires_at END,
    notes         = CASE WHEN p_fields ? 'notes'
                         THEN NULLIF(p_fields ->> 'notes', '')
                         ELSE notes END,
    data          = p_data,
    version       = v_new_version,
    updated_at    = now()
  WHERE id = p_config_id;

  RETURN v_new_version;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_config_version(uuid, uuid, integer, jsonb, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_config_version(uuid, uuid, integer, jsonb, text, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- restore_config_version — restore always creates a NEW version.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_config_version(
  p_config_id      uuid,
  p_actor          uuid,
  p_version_number integer,
  p_summary        text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data           jsonb;
  v_current_version integer;
BEGIN
  -- Read the snapshot. Ownership and caller identity are re-verified inside
  -- bump_config_version, which is the only writer on this path.
  SELECT data
    INTO v_data
  FROM public.configuration_versions
  WHERE configuration_id = p_config_id
    AND version_number = p_version_number;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'restore_config_version: version % not found', p_version_number
      USING ERRCODE = 'P0002';
  END IF;

  SELECT version INTO v_current_version
  FROM public.configurations
  WHERE id = p_config_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'restore_config_version: configuration not found'
      USING ERRCODE = 'P0002';
  END IF;

  -- The restored snapshot becomes a NEW version; metadata (name, status,
  -- project, ...) stays as-is, only `data` is rolled back.
  RETURN public.bump_config_version(
    p_config_id,
    p_actor,
    v_current_version,
    v_data,
    COALESCE(NULLIF(p_summary, ''), 'Restored version ' || p_version_number::text),
    '{}'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.restore_config_version(uuid, uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_config_version(uuid, uuid, integer, text) TO authenticated;

-- ================= 0005_user_preferences.sql ================
-- ============================================================================
-- Aidify migration 0005 — per-user preferences (brief: persisted settings)
--
-- Adds `profiles.preferences` (JSONB, default '{}') holding user settings:
--   { "emailNotifications": bool, "defaultPageSize": 10|20|50,
--     "defaultEnvironment": "development"|"staging"|"production"|"custom",
--     "maskSecrets": bool }
--
-- Access pattern matches the profiles owner policy: a user reads/updates only
-- their own row; the column is included in the existing SELECT/UPDATE
-- policies, so no new policy is required.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}';

-- Backfill guard for rows inserted before this migration (DEFAULT already
-- covers inserts, this is for any NULLs from exotic paths).
UPDATE public.profiles SET preferences = '{}' WHERE preferences IS NULL;
-- 0006: expose profiles -> user_roles relationship to PostgREST.
--
-- The DAL embeds roles via `profiles.select('..., user_roles(roles(name))')`.
-- user_roles.user_id already references auth.users(id); add a second FK to
-- profiles(id) (same UUIDs, 1:1 with auth.users) so PostgREST can resolve the
-- profiles -> user_roles -> roles join path.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Tell PostgREST to reload its schema cache so the new relationship is visible.
NOTIFY pgrst, 'reload schema';
