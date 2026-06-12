-- ============================================================
-- KIZAGA RMS: Seed Auth Users + Profiles + Email Confirmation
-- Run this in Supabase SQL Editor AFTER migration_tables.sql
-- Idempotent: safe to run multiple times
-- ============================================================

-- 1. Ensure email verification is disabled for existing users
UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, NOW());

-- 2. Auto-confirm future users
CREATE OR REPLACE FUNCTION auto_confirm_email()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email_confirmed_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_confirm_email ON auth.users;
CREATE TRIGGER trg_auto_confirm_email
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION auto_confirm_email();

-- 3. Create auth users + profiles (skips if email already exists)
DO $$
DECLARE
  uid uuid;
  rec RECORD;
BEGIN
  FOR rec IN (
    SELECT 'admin@school.com' AS email, 'Admin@123' AS pwd, 'Admin User' AS name, 'admin' AS role
    UNION ALL SELECT 'headmaster@school.com', 'Headmaster@123', 'Headmaster User', 'headmaster'
    UNION ALL SELECT 'academic@school.com', 'Academic@123', 'Academic User', 'academic'
    UNION ALL SELECT 'teacher@school.com', 'Teacher@123', 'Teacher User', 'teacher'
  ) LOOP
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = rec.email) THEN
      uid := gen_random_uuid();

      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, confirmation_sent_at, confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token,
        email_change, email_change_token_new, recovery_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        uid, 'authenticated', 'authenticated', rec.email,
        crypt(rec.pwd, gen_salt('bf')),
        NOW(), NOW(), NOW(),
        jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
        jsonb_build_object('full_name', rec.name, 'role', rec.role),
        NOW(), NOW(), '', '', '', ''
      );

      INSERT INTO public.profiles (id, email, full_name, role)
      VALUES (uid, rec.email, rec.name, rec.role)
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END LOOP;
END $$;
