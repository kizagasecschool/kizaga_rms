-- Fix storage.objects policies for joining-instructions-pdfs bucket.
-- Old policies use EXISTS (SELECT 1 FROM profiles WHERE role IN (...))
-- which runs under caller's RLS and can silently return false.
-- Replace with get_my_role() (SECURITY DEFINER).

DROP POLICY IF EXISTS "admin_headmaster_insert_joining_instructions_pdfs" ON storage.objects;
DROP POLICY IF EXISTS "admin_headmaster_update_joining_instructions_pdfs" ON storage.objects;
DROP POLICY IF EXISTS "admin_headmaster_delete_joining_instructions_pdfs" ON storage.objects;

CREATE POLICY "admin_headmaster_insert_joining_instructions_pdfs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'joining-instructions-pdfs'
    AND get_my_role() IN ('admin', 'headmaster')
  );

CREATE POLICY "admin_headmaster_update_joining_instructions_pdfs"
  ON storage.objects FOR UPDATE TO authenticated
  USING     (bucket_id = 'joining-instructions-pdfs' AND get_my_role() IN ('admin', 'headmaster'))
  WITH CHECK(bucket_id = 'joining-instructions-pdfs' AND get_my_role() IN ('admin', 'headmaster'));

CREATE POLICY "admin_headmaster_delete_joining_instructions_pdfs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'joining-instructions-pdfs' AND get_my_role() IN ('admin', 'headmaster'));

-- Verify
SELECT policyname, cmd, with_check IS NOT NULL AS has_with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname LIKE '%joining%'
ORDER BY cmd;
