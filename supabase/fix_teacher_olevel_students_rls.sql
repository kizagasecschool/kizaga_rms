-- Fix: teachers can now see O-Level students (who have class_stream_id = NULL)
-- The old policy only checked class_stream_id IN (...), which excluded O-Level students
-- because NULL IN (...) evaluates to NULL (not TRUE) in Postgres.
-- The new policy also allows access via class_id for O-Level students.

DROP POLICY IF EXISTS "teacher_read_assigned_students" ON students;

CREATE POLICY "teacher_read_assigned_students" ON students FOR SELECT USING (
  get_my_role() = 'teacher'
  AND (
    -- A-Level: student has a stream directly matching teacher's assignment
    class_stream_id IN (
      SELECT ts.class_stream_id
      FROM teacher_subjects ts
      JOIN teachers t ON t.id = ts.teacher_id
      WHERE t.profile_id = auth.uid()
    )
    OR
    -- O-Level: student belongs to a class that contains teacher's assigned streams
    class_id IN (
      SELECT cs.class_id
      FROM teacher_subjects ts
      JOIN teachers t ON t.id = ts.teacher_id
      JOIN class_streams cs ON cs.id = ts.class_stream_id
      WHERE t.profile_id = auth.uid()
    )
  )
);
