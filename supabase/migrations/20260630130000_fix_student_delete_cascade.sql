-- ============================================================
-- Fix: Add ON DELETE CASCADE to all foreign keys that reference
-- students(id) so that deleting a student (or all graduates)
-- also removes their marks, results, attendance, and subject
-- assignments automatically.
--
-- Affected tables: marks, student_results, attendance,
--                  student_subjects
-- ============================================================

-- ---- marks -------------------------------------------------
ALTER TABLE public.marks
  DROP CONSTRAINT IF EXISTS marks_student_id_fkey,
  ADD CONSTRAINT marks_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- ---- student_results ---------------------------------------
ALTER TABLE public.student_results
  DROP CONSTRAINT IF EXISTS student_results_student_id_fkey,
  ADD CONSTRAINT student_results_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- ---- attendance --------------------------------------------
ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS attendance_student_id_fkey,
  ADD CONSTRAINT attendance_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- ---- student_subjects --------------------------------------
ALTER TABLE public.student_subjects
  DROP CONSTRAINT IF EXISTS student_subjects_student_id_fkey,
  ADD CONSTRAINT student_subjects_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- ============================================================
-- Verify all four constraints now have ON DELETE CASCADE
-- ============================================================
SELECT
  tc.table_name,
  kcu.column_name,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
JOIN information_schema.key_column_usage ccu
  ON rc.unique_constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'students'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;
