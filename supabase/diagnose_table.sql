SELECT policyname, cmd, roles::text, qual, with_check
FROM pg_policies
WHERE tablename = 'joining_instructions'
ORDER BY cmd;
