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
