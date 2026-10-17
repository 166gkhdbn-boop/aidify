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
