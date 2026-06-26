-- Supabase storage policy evaluator requires get_my_role() to be called
-- inside a subquery (SELECT get_my_role()) to resolve correctly.
-- Direct function calls fail silently in the storage schema context.
-- The existing school-logos policies already use (SELECT get_my_role()) —
-- all our new storage policies must match that pattern.

-- ---- joining-instructions-pdfs ----------------------------
DROP POLICY IF EXISTS "admin_headmaster_insert_joining_instructions_pdfs" ON storage.objects;
DROP POLICY IF EXISTS "admin_headmaster_update_joining_instructions_pdfs" ON storage.objects;
DROP POLICY IF EXISTS "admin_headmaster_delete_joining_instructions_pdfs" ON storage.objects;

CREATE POLICY "admin_headmaster_insert_joining_instructions_pdfs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'joining-instructions-pdfs'
    AND (SELECT get_my_role()) IN ('admin', 'headmaster')
  );

CREATE POLICY "admin_headmaster_update_joining_instructions_pdfs"
  ON storage.objects FOR UPDATE TO authenticated
  USING     (bucket_id = 'joining-instructions-pdfs' AND (SELECT get_my_role()) IN ('admin', 'headmaster'))
  WITH CHECK(bucket_id = 'joining-instructions-pdfs' AND (SELECT get_my_role()) IN ('admin', 'headmaster'));

CREATE POLICY "admin_headmaster_delete_joining_instructions_pdfs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'joining-instructions-pdfs' AND (SELECT get_my_role()) IN ('admin', 'headmaster'));

-- ---- events-media -----------------------------------------
DROP POLICY IF EXISTS "admin_headmaster_insert_events_media" ON storage.objects;
DROP POLICY IF EXISTS "admin_headmaster_update_events_media" ON storage.objects;
DROP POLICY IF EXISTS "admin_headmaster_delete_events_media" ON storage.objects;

CREATE POLICY "admin_headmaster_insert_events_media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'events-media'
    AND (SELECT get_my_role()) IN ('admin', 'headmaster')
  );

CREATE POLICY "admin_headmaster_update_events_media"
  ON storage.objects FOR UPDATE TO authenticated
  USING     (bucket_id = 'events-media' AND (SELECT get_my_role()) IN ('admin', 'headmaster'))
  WITH CHECK(bucket_id = 'events-media' AND (SELECT get_my_role()) IN ('admin', 'headmaster'));

CREATE POLICY "admin_headmaster_delete_events_media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'events-media' AND (SELECT get_my_role()) IN ('admin', 'headmaster'));

-- Verify — should now match school-logos pattern
SELECT policyname, cmd,
       with_check LIKE '%(SELECT get_my_role())%'
         OR qual    LIKE '%(SELECT get_my_role())%' AS uses_subquery_wrapper
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname NOT LIKE '%public%' AND policyname NOT LIKE '%app_files%'
ORDER BY policyname;
