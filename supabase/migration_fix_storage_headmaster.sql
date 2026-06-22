-- Allow headmaster to insert/update/delete in school-logos bucket
DROP POLICY IF EXISTS "admin_insert_school_logos" ON storage.objects;
CREATE POLICY "admin_insert_school_logos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'school-logos'
    AND (SELECT get_my_role()) IN ('admin', 'headmaster')
  );

DROP POLICY IF EXISTS "admin_update_school_logos" ON storage.objects;
CREATE POLICY "admin_update_school_logos" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'school-logos'
    AND (SELECT get_my_role()) IN ('admin', 'headmaster')
  );

DROP POLICY IF EXISTS "admin_delete_school_logos" ON storage.objects;
CREATE POLICY "admin_delete_school_logos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'school-logos'
    AND (SELECT get_my_role()) IN ('admin', 'headmaster')
  );
