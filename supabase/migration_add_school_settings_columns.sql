-- Add region, district, national_logo_url columns to school_settings
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS region          TEXT;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS district        TEXT;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS national_logo_url TEXT;

-- Create storage bucket for school logos (idempotent)
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
SELECT 'school-logos', 'school-logos', TRUE, FALSE, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'school-logos');

-- Allow public access to school-logos bucket
DROP POLICY IF EXISTS "public_select_school_logos" ON storage.objects;
CREATE POLICY "public_select_school_logos" ON storage.objects
  FOR SELECT USING (bucket_id = 'school-logos');

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

-- Also give headmaster write access to school_settings
DROP POLICY IF EXISTS "admin_all_school_settings" ON school_settings;
CREATE POLICY "admin_all_school_settings" ON school_settings
  FOR ALL USING ((SELECT get_my_role()) IN ('admin', 'headmaster'));
