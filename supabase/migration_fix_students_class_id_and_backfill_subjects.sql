-- ============================================================
-- KIZAGA RMS: Fix students.class_id + backfill student_subjects
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. ADD class_id TO students (if not already present)
ALTER TABLE students ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);

-- Backfill: set class_id from existing class_stream relationships
UPDATE students
SET class_id = cs.class_id
FROM class_streams cs
WHERE students.class_stream_id = cs.id
  AND students.class_id IS NULL;

-- 2. BACKFILL missing student_subjects records
-- For every subject assigned to a class, ensure all students in that class's
-- streams are enrolled (unless already present in student_subjects).
INSERT INTO student_subjects (student_id, subject_id)
SELECT s.id, sa.subject_id
FROM subject_assignments sa
JOIN class_streams cs ON cs.class_id = sa.class_id
JOIN students s ON s.class_stream_id = cs.id AND s.status = 'active'
WHERE NOT EXISTS (
  SELECT 1 FROM student_subjects ss
  WHERE ss.student_id = s.id AND ss.subject_id = sa.subject_id
)
ON CONFLICT (student_id, subject_id) DO NOTHING;

-- 3. REFRESH PostgREST schema cache so it picks up the new column
NOTIFY pgrst, 'reload schema';
