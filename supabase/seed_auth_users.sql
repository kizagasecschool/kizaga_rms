-- ============================================================
-- KIZAGA RMS: Seed Auth Users + Profiles + Email Confirmation
-- Run this in Supabase SQL Editor AFTER migration_tables.sql
-- Idempotent: safe to run multiple times
-- ============================================================

-- 0. Ensure pgcrypto extension is available
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

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

-- 3. Clean up any previous partial inserts
DELETE FROM public.profiles WHERE email IN ('admin@school.com','headmaster@school.com','academic@school.com','teacher@school.com');
DELETE FROM auth.users WHERE email IN ('admin@school.com','headmaster@school.com','academic@school.com','teacher@school.com');

-- 4. Create auth users with proper bcrypt hashes (cost factor 10 to match GoTrue)
DO $$
DECLARE
  uid uuid;
  rec RECORD;
  hash text;
BEGIN
  FOR rec IN (
    SELECT 'admin@school.com' AS email, 'Admin@123' AS pwd, 'Admin User' AS name, 'admin' AS role
    UNION ALL SELECT 'headmaster@school.com', 'Headmaster@123', 'Headmaster User', 'headmaster'
    UNION ALL SELECT 'academic@school.com', 'Academic@123', 'Academic User', 'academic'
    UNION ALL SELECT 'teacher@school.com', 'Teacher@123', 'Teacher User', 'teacher'
  ) LOOP
    -- Generate bcrypt hash with cost factor 10 (matching GoTrue default)
    hash := extensions.crypt(rec.pwd, extensions.gen_salt('bf', 10));
    uid := extensions.gen_random_uuid();

    -- Only essential columns to avoid schema mismatch across Supabase versions
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, confirmation_sent_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
    VALUES (uid, rec.email, hash, NOW(), NOW(), jsonb_build_object('provider', 'email', 'providers', ARRAY['email']), jsonb_build_object('full_name', rec.name, 'role', rec.role), NOW(), NOW(), false, false);

    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (uid, rec.email, rec.name, rec.role)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role = EXCLUDED.role;

    RAISE NOTICE 'Created % (%): %', rec.email, rec.role, uid;
  END LOOP;
END $$;

-- 5. Also run fix_profiles_rls (critical for RLS chicken-and-egg)
DROP POLICY IF EXISTS admin_all_profiles ON profiles;
DROP POLICY IF EXISTS headmaster_read_profiles ON profiles;
DROP POLICY IF EXISTS academic_read_profiles ON profiles;
DROP POLICY IF EXISTS academic_write_profiles ON profiles;
DROP POLICY IF EXISTS academic_update_profiles ON profiles;
DROP POLICY IF EXISTS teacher_own_profile ON profiles;
DROP POLICY IF EXISTS teacher_update_own_profile ON profiles;

CREATE POLICY "admin_all_profiles" ON profiles FOR ALL USING (get_my_role() = 'admin');
CREATE POLICY "headmaster_read_profiles" ON profiles FOR SELECT USING (get_my_role() = 'headmaster');
CREATE POLICY "academic_all_profiles" ON profiles FOR ALL USING (get_my_role() = 'academic');
CREATE POLICY "users_insert_own_profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_select_own_profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own_profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- 6. Auto-create profile trigger for future sign-ups
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), COALESCE(NEW.raw_user_meta_data->>'role', 'teacher'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 7. Verify
SELECT id::text, email, role, encrypted_password IS NOT NULL AS has_password
FROM auth.users
WHERE email IN ('admin@school.com','headmaster@school.com','academic@school.com','teacher@school.com');
