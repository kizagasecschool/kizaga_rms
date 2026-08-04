-- Full function definition
SELECT pg_get_functiondef(oid) AS def
FROM pg_proc
WHERE proname = 'get_my_role' AND pronamespace = 'public'::regnamespace;

-- Check if auth schema functions exist and their definitions
SELECT proname, pg_get_functiondef(oid) AS def
FROM pg_proc
WHERE proname = 'uid' AND pronamespace = 'auth'::regnamespace;

-- Check all profiles for admin/headmaster roles (anonymised)
SELECT id, email, role, created_at
FROM profiles
WHERE role IN ('admin', 'headmaster')
ORDER BY role;
