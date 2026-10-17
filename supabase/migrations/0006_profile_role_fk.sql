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
