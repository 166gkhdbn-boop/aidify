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
