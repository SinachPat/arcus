-- Migration 004: Auth signup trigger
-- Creates handle_new_user() and the on_auth_user_created trigger.
-- This was previously only in scripts/full-setup.sql and would be lost
-- on any database reset / re-provision via migrations.
--
-- Changes vs original:
--   - NULLIF guards prevent empty-string names slipping through
--   - Hard 'User' fallback ensures name is never NULL (guards the NOT NULL constraint)
--   - EXCEPTION block logs failures without blocking auth signup

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, auth_provider)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
      NULLIF(SPLIT_PART(NEW.email, '@', 1), ''),
      'User'
    ),
    CASE
      WHEN NEW.raw_app_meta_data->>'provider' = 'google' THEN 'google'::auth_provider_enum
      WHEN NEW.raw_app_meta_data->>'provider' = 'github' THEN 'github'::auth_provider_enum
      ELSE 'email'::auth_provider_enum
    END
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed for %: % %', NEW.id, SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
