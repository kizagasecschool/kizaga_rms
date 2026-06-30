-- ============================================================
-- Allow anonymous (public) users to read the students and
-- classes tables so the Landing page can display O-Level /
-- A-Level student counts without requiring authentication.
--
-- NOTE: This exposes student records to unauthenticated users
-- via the Supabase REST API. Only count queries are made by
-- the app, but direct API callers can read all columns.
-- ============================================================

-- ---- students ----------------------------------------------
DROP POLICY IF EXISTS "public_read_students" ON students;
CREATE POLICY "public_read_students"
  ON students FOR SELECT TO anon
  USING (true);

-- ---- classes -----------------------------------------------
-- Landing page reads class IDs + level to split O/A counts.
DROP POLICY IF EXISTS "public_read_classes" ON classes;
CREATE POLICY "public_read_classes"
  ON classes FOR SELECT TO anon
  USING (true);

-- ============================================================
-- Verify
-- ============================================================
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('students', 'classes')
ORDER BY tablename, cmd;
