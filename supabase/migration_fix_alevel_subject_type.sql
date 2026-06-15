-- ============================================================
-- FIX: A-Level subject_type values
-- A-Level subjects use PRINCIPAL, SUBSIDIARY, OPTIONAL
-- (not COMPULSORY, ELECTIVE which are O-Level conventions)
-- ============================================================

-- 1. Widen the CHECK constraint to accept all valid types
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_subject_type_check;
ALTER TABLE subjects ADD CONSTRAINT subjects_subject_type_check
  CHECK (subject_type IN ('COMPULSORY', 'OPTIONAL', 'ELECTIVE', 'PRINCIPAL', 'SUBSIDIARY'));

-- 2. Migrate existing A-Level subjects
UPDATE subjects SET subject_type = 'PRINCIPAL'  WHERE level = 'A_LEVEL' AND subject_type = 'COMPULSORY';
UPDATE subjects SET subject_type = 'SUBSIDIARY' WHERE level = 'A_LEVEL' AND subject_type = 'ELECTIVE';
