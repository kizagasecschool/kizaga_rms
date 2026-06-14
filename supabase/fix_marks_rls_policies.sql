-- ============================================================
-- FIX: Marks RLS policies for teacher upsert
-- Problem: staff_update_own_marks uses `entered_by = auth.uid()`
-- in USING clause, which checks the EXISTING row. When a
-- teacher upserts a mark originally entered by someone else
-- (e.g. academic), the UPDATE fails because entered_by doesn't
-- match the current user.
--
-- Fix: Change UPDATE policies to only check subject assignment,
-- not who originally entered the mark.
-- INSERT policies still validate entered_by via WITH CHECK.
-- ============================================================

-- ============================================================
-- 1. Drop old UPDATE policies
-- ============================================================
DROP POLICY IF EXISTS "staff_update_own_marks" ON marks;
DROP POLICY IF EXISTS "teacher_manage_own_marks" ON marks;

-- ============================================================
-- 2. Recreate teacher_manage_own_marks WITHOUT entered_by check
-- Allows teacher to manage marks for their assigned subjects
-- regardless of who originally entered them.
-- ============================================================
CREATE POLICY "teacher_manage_own_marks" ON marks
  FOR ALL USING (
    get_my_role() = 'teacher'
    AND subject_id IN (
      SELECT ts.subject_id
      FROM teacher_subjects ts
      JOIN teachers t ON t.id = ts.teacher_id
      WHERE t.profile_id = auth.uid()
    )
  );

-- ============================================================
-- 3. Recreate staff_update_own_marks WITHOUT entered_by check
-- ============================================================
CREATE POLICY "staff_update_own_marks" ON marks
  FOR UPDATE USING (
    get_my_role() IN ('academic', 'teacher')
    AND subject_id IN (
      SELECT ts.subject_id
      FROM teacher_subjects ts
      JOIN teachers t ON t.id = ts.teacher_id
      WHERE t.profile_id = auth.uid()
    )
  );
