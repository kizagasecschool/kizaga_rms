-- Diagnose first: show current storage policies for joining-instructions-pdfs
SELECT policyname, cmd, roles::text
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname LIKE '%joining%'
ORDER BY cmd;

-- Fix: drop all old variants (with or without TO authenticated)
DROP POLICY IF EXISTS "admin_headmaster_insert_joining_instructions_pdfs" ON storage.objects;
DROP POLICY IF EXISTS "admin_headmaster_update_joining_instructions_pdfs" ON storage.objects;
DROP POLICY IF EXISTS "admin_headmaster_delete_joining_instructions_pdfs" ON storage.objects;

-- Recreate WITHOUT TO clause (defaults to TO public — required because Supabase
-- Storage evaluates policies as the 'public' role, not 'authenticated')
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

-- Also fix the joining_instructions TABLE policy (uses EXISTS which can fail silently)
DROP POLICY IF EXISTS "admin_headmaster_all_joining_instructions" ON joining_instructions;
CREATE POLICY "admin_headmaster_all_joining_instructions"
  ON joining_instructions FOR ALL
  USING   ((SELECT get_my_role()) IN ('admin', 'headmaster'))
  WITH CHECK ((SELECT get_my_role()) IN ('admin', 'headmaster'));

-- Verify: roles column should be {public} for write policies (not {authenticated})
SELECT policyname, cmd, roles::text,
       CASE WHEN roles::text = '{public}' THEN 'OK' ELSE 'WRONG ROLE' END AS status
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname LIKE '%joining%'
ORDER BY cmd;
