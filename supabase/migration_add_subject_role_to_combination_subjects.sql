-- ============================================================
-- Add subject_role column to combination_subjects
-- Each A-Level subject within a combination can be:
--   CORE        → principal subject (3 per combination)
--   SUBSIDIARY  → subsidiary subject (typically 1)
--   OPTIONAL    → optional subject (any number)
-- ============================================================

-- 1. Add column (nullable first so existing rows are untouched)
ALTER TABLE combination_subjects ADD COLUMN IF NOT EXISTS subject_role TEXT;

-- 2. Existing rows default to CORE
UPDATE combination_subjects SET subject_role = 'CORE' WHERE subject_role IS NULL;

-- 3. Add / replace CHECK constraint
ALTER TABLE combination_subjects DROP CONSTRAINT IF EXISTS combination_subjects_subject_role_check;
ALTER TABLE combination_subjects ADD CONSTRAINT combination_subjects_subject_role_check
  CHECK (subject_role IN ('CORE', 'SUBSIDIARY', 'OPTIONAL'));

-- 4. Now safe to mark NOT NULL
ALTER TABLE combination_subjects ALTER COLUMN subject_role SET NOT NULL;
