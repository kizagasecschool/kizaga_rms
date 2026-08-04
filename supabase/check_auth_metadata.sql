-- Check if roles are stored in auth.users metadata (accessible via JWT)
SELECT id, email,
       raw_app_meta_data,
       raw_user_meta_data
FROM auth.users
WHERE email IN ('admin@school.com', 'headmaster@school.com');

-- Check the get_my_role function definition
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'get_my_role' AND pronamespace = 'public'::regnamespace;
