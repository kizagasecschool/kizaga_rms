-- Nuclear fix: wipe all joining-instructions-pdfs storage policies and
-- replace with the simplest form that Supabase storage actually evaluates.
-- Uses auth.uid() lookup against profiles directly (no function call).

DO $$
DECLARE pol TEXT;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname LIKE '%joining%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol);
    RAISE NOTICE 'Dropped: %', pol;
  END LOOP;
END $$;

-- SELECT: anyone can read (public bucket)
CREATE POLICY "joining_pdfs_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'joining-instructions-pdfs');

-- INSERT: admin or headmaster only — inline join, no helper function
CREATE POLICY "joining_pdfs_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'joining-instructions-pdfs'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'headmaster')
    )
  );

-- UPDATE
CREATE POLICY "joining_pdfs_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'joining-instructions-pdfs'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'headmaster')
    )
  )
  WITH CHECK (
    bucket_id = 'joining-instructions-pdfs'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'headmaster')
    )
  );

-- DELETE
CREATE POLICY "joining_pdfs_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'joining-instructions-pdfs'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'headmaster')
    )
  );

-- Verify
SELECT policyname, cmd, roles::text, with_check IS NOT NULL AS has_with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname LIKE '%joining%'
ORDER BY cmd;
