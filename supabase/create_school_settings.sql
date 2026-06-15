-- ============================================================
-- SCHOOL SETTINGS — Kamili (Run hii kwenye Supabase SQL Editor)
-- Inaunda table, RLS, storage bucket, na seed data
-- ============================================================

-- 1. UNDA TABLE IKIWA HAIJAKUWEPO
CREATE TABLE IF NOT EXISTS school_settings (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_name       TEXT NOT NULL,
  school_code       TEXT NOT NULL UNIQUE,
  address           TEXT,
  phone             TEXT,
  email             TEXT,
  region            TEXT,          -- Mkoa
  district          TEXT,          -- Wilaya
  logo_url          TEXT,          -- Logo ya shule
  national_logo_url TEXT,          -- Logo ya umoja (Tanzania Coat of Arms)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. ONGEZA COLUMNS IKIWA HAZIPO (kwa usalama)
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS school_name       TEXT;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS school_code       TEXT;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS address           TEXT;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS phone             TEXT;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS email             TEXT;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS region            TEXT;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS district          TEXT;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS logo_url          TEXT;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS national_logo_url TEXT;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 3. TRIGGER — updated_at inabadilika kiotomatiki
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_school_settings_updated_at ON school_settings;
CREATE TRIGGER trg_school_settings_updated_at
  BEFORE UPDATE ON school_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. WEKA UNIQUE CONSTRAINT kwa school_code (ikiwa haipo)
-- (CREATE TABLE tayari ina UNIQUE, hii ni kwa usalama)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'school_settings_school_code_key'
    AND conrelid = 'school_settings'::regclass
  ) THEN
    ALTER TABLE school_settings ADD CONSTRAINT school_settings_school_code_key UNIQUE (school_code);
  END IF;
END $$;

-- 5. WEZESHA RLS
ALTER TABLE school_settings ENABLE ROW LEVEL SECURITY;

-- 6. UNDA POLICIES
-- Admin na headmaster: ALL (kuona, kuongeza, kubadilisha, kufuta)
DROP POLICY IF EXISTS "admin_headmaster_all_school_settings" ON school_settings;
CREATE POLICY "admin_headmaster_all_school_settings" ON school_settings
  FOR ALL USING ((SELECT get_my_role()) IN ('admin', 'headmaster'));

-- Academic na teacher: wanaweza kuona tu
DROP POLICY IF EXISTS "read_school_settings" ON school_settings;
CREATE POLICY "read_school_settings" ON school_settings
  FOR SELECT USING ((SELECT get_my_role()) IN ('academic', 'teacher'));

-- 7. UNDA STORAGE BUCKET kwa ajili ya logo (ikiwa haipo)
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
SELECT 'school-logos', 'school-logos', TRUE, FALSE, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'school-logos');

-- 8. STORAGE POLICIES
-- Kila mtu anaweza kuona logo
DROP POLICY IF EXISTS "public_select_school_logos" ON storage.objects;
CREATE POLICY "public_select_school_logos" ON storage.objects
  FOR SELECT USING (bucket_id = 'school-logos');

-- Admin pekee anaweza kupakia, kubadilisha, kufuta
DROP POLICY IF EXISTS "admin_insert_school_logos" ON storage.objects;
CREATE POLICY "admin_insert_school_logos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'school-logos'
    AND (SELECT get_my_role()) = 'admin'
  );

DROP POLICY IF EXISTS "admin_update_school_logos" ON storage.objects;
CREATE POLICY "admin_update_school_logos" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'school-logos'
    AND (SELECT get_my_role()) = 'admin'
  );

DROP POLICY IF EXISTS "admin_delete_school_logos" ON storage.objects;
CREATE POLICY "admin_delete_school_logos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'school-logos'
    AND (SELECT get_my_role()) = 'admin'
  );

-- 9. WEKA DATA YA MWANZO (default) ikiwa hakuna data yoyote
INSERT INTO school_settings (school_name, school_code, address, phone, email)
SELECT 'Shule Yako', 'SCH001', 'Anuani yako', '+255 700 000 000', 'info@shule.ac.tz'
WHERE NOT EXISTS (SELECT 1 FROM school_settings);
