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
