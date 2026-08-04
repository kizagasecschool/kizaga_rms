-- ROOT CAUSE: Supabase Storage evaluates policies under the 'public' role,
-- not 'authenticated'. Policies created with TO authenticated are invisible
-- to the storage engine and never grant access.
-- Evidence: working school-logos policies use roles={public}; our new
-- joining-instructions-pdfs / events-media policies used roles={authenticated}.
--
-- Fix: recreate all storage WRITE policies without a TO clause
-- (which defaults to TO public, covering all roles).

-- ---- joining-instructions-pdfs ----------------------------
DROP POLICY IF EXISTS "admin_headmaster_insert_joining_instructions_pdfs" ON storage.objects;
DROP POLICY IF EXISTS "admin_headmaster_update_joining_instructions_pdfs" ON storage.objects;
DROP POLICY IF EXISTS "admin_headmaster_delete_joining_instructions_pdfs" ON storage.objects;

CREATE POLICY "admin_headmaster_insert_joining_instructions_pdfs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'joining-instructions-pdfs'
    AND (SELECT get_my_role()) IN ('admin', 'headmaster')
  );

CREATE POLICY "admin_headmaster_update_joining_instructions_pdfs"
  ON storage.objects FOR UPDATE
  USING     (bucket_id = 'joining-instructions-pdfs' AND (SELECT get_my_role()) IN ('admin', 'headmaster'))
  WITH CHECK(bucket_id = 'joining-instructions-pdfs' AND (SELECT get_my_role()) IN ('admin', 'headmaster'));

CREATE POLICY "admin_headmaster_delete_joining_instructions_pdfs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'joining-instructions-pdfs' AND (SELECT get_my_role()) IN ('admin', 'headmaster'));

-- ---- events-media -----------------------------------------
DROP POLICY IF EXISTS "admin_headmaster_insert_events_media" ON storage.objects;
DROP POLICY IF EXISTS "admin_headmaster_update_events_media" ON storage.objects;
DROP POLICY IF EXISTS "admin_headmaster_delete_events_media" ON storage.objects;

CREATE POLICY "admin_headmaster_insert_events_media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'events-media'
    AND (SELECT get_my_role()) IN ('admin', 'headmaster')
  );

CREATE POLICY "admin_headmaster_update_events_media"
  ON storage.objects FOR UPDATE
  USING     (bucket_id = 'events-media' AND (SELECT get_my_role()) IN ('admin', 'headmaster'))
  WITH CHECK(bucket_id = 'events-media' AND (SELECT get_my_role()) IN ('admin', 'headmaster'));

CREATE POLICY "admin_headmaster_delete_events_media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'events-media' AND (SELECT get_my_role()) IN ('admin', 'headmaster'));

-- Verify: all write policies should now have roles = {public}
SELECT policyname, cmd, roles::text
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND cmd IN ('INSERT','UPDATE','DELETE')
ORDER BY policyname;
