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
