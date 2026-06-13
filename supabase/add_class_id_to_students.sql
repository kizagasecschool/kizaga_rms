-- ============================================================
-- KIZAGA RMS: Add class_id column to students table
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add class_id column (nullable, FK to classes)
ALTER TABLE students ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);

-- Backfill: set class_id from existing class_stream relationships
UPDATE students
SET class_id = cs.class_id
FROM class_streams cs
WHERE students.class_stream_id = cs.id
  AND students.class_id IS NULL;
