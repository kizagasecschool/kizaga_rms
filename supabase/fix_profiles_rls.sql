-- ============================================================
-- KIZAGA RMS: Fix profiles RLS — auto-create profile trigger
-- + proper INSERT policy for own profile
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. Ensure RLS is enabled
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Drop ALL existing policies on profiles to avoid conflicts
-- ============================================================
DROP POLICY IF EXISTS "admin_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "headmaster_read_profiles" ON public.profiles;
DROP POLICY IF EXISTS "academic_read_profiles" ON public.profiles;
DROP POLICY IF EXISTS "academic_write_profiles" ON public.profiles;
DROP POLICY IF EXISTS "academic_update_profiles" ON public.profiles;
DROP POLICY IF EXISTS "teacher_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "teacher_update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin full access" ON public.profiles;
DROP POLICY IF EXISTS "Headmaster read only" ON public.profiles;
DROP POLICY IF EXISTS "Academic select" ON public.profiles;
DROP POLICY IF EXISTS "Academic update" ON public.profiles;
DROP POLICY IF EXISTS "Teacher read own" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- ============================================================
-- 3. Create clean, correct policies
-- ============================================================

-- 3a. Admin full access (already has profile, get_my_role() works)
CREATE POLICY "admin_all_profiles" ON public.profiles
  FOR ALL
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- 3b. Headmaster read only
CREATE POLICY "headmaster_read_profiles" ON public.profiles
  FOR SELECT
  USING (get_my_role() = 'headmaster');

-- 3c. Academic full access
CREATE POLICY "academic_all_profiles" ON public.profiles
  FOR ALL
  USING (get_my_role() = 'academic')
  WITH CHECK (get_my_role() = 'academic');

-- 3d. Users can INSERT their own profile (CRITICAL: uses auth.uid()
--     directly so it works EVEN when get_my_role() returns NULL)
CREATE POLICY "users_insert_own_profile" ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 3e. Users can SELECT / UPDATE their own profile
CREATE POLICY "users_select_own_profile" ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users_update_own_profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- 4. Ensure the auto-create profile trigger exists
--    (creates profile row automatically on auth.users insert)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'teacher')
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists — nothing to do
    RETURN NEW;
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user error: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 5. Ensure get_my_role() works
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- 6. Auto-confirm emails for all existing users
-- ============================================================
UPDATE auth.users SET email_confirmed_at = NOW() WHERE email_confirmed_at IS NULL;

-- ============================================================
-- 7. Fix existing profiles: create missing profiles for auth users
-- ============================================================
INSERT INTO public.profiles (id, email, full_name, role)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data ->> 'full_name', au.email, 'User'),
  COALESCE(au.raw_user_meta_data ->> 'role', 'teacher')
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 8. Verify
-- ============================================================
SELECT 'profiles count' AS check_name, COUNT(*) AS value FROM public.profiles
UNION ALL
SELECT 'policies count', COUNT(*) FROM pg_policies WHERE tablename = 'profiles'
UNION ALL
SELECT 'trigger exists', COUNT(*) FROM pg_trigger WHERE tgname = 'on_auth_user_created';
