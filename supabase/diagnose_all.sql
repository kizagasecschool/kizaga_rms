-- 1. All policies on joining_instructions table
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'joining_instructions';

-- 2. All INSERT/UPDATE policies on storage.objects for joining-instructions-pdfs
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND (policyname LIKE '%joining%' OR policyname LIKE '%school-logos%')
ORDER BY policyname;

-- 3. Test auth.uid() in current context (will be NULL in SQL editor, but verifies function exists)
SELECT auth.uid() AS current_uid, get_my_role() AS current_role;

-- 4. Check auth.users metadata for admin
SELECT id, email,
       raw_app_meta_data ->> 'role' AS app_role,
       raw_user_meta_data ->> 'role' AS user_role
FROM auth.users
WHERE email IN ('admin@school.com', 'headmaster@school.com');
