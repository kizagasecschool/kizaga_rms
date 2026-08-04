-- Show the EXACT current policy text for joining-instructions-pdfs
SELECT
  policyname,
  cmd,
  roles::text,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%joining%'
ORDER BY cmd;
