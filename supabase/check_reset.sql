-- Check if password_reset_tokens table exists
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'password_reset_tokens'
ORDER BY ordinal_position;

-- Check if the table has any rows (to confirm it's usable)
SELECT COUNT(*) AS total_tokens FROM password_reset_tokens;
