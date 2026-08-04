-- ============================================================
-- Fix practical marks: flag only science subjects, clean data
--
-- 1. Set has_practical for O-Level sciences (BIO_O, CHEM_O, PHY_O)
-- 2. Clear has_practical for all other O-Level subjects
-- 3. NULL out practical_marks for non-practical subjects
-- 4. Clamp any marks_obtained > 100 to 100
-- ============================================================

-- Ensure has_practical column exists on subjects
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS has_practical BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark O-Level science subjects as having practical
UPDATE subjects
SET has_practical = TRUE
WHERE subject_code IN ('BIO_O', 'CHEM_O', 'PHY_O')
  AND NOT has_practical;

-- Clear has_practical for all other O-Level subjects
UPDATE subjects
SET has_practical = FALSE
WHERE level = 'O_LEVEL'
  AND subject_code NOT IN ('BIO_O', 'CHEM_O', 'PHY_O')
  AND has_practical;

-- NULL out practical_marks for subjects that don't have practical
UPDATE marks m
SET practical_marks = NULL
FROM subjects s
WHERE m.subject_id = s.id
  AND (s.has_practical IS NOT TRUE OR s.has_practical IS NULL)
  AND m.practical_marks IS NOT NULL;

-- Clamp any marks_obtained that exceed limits
UPDATE marks
SET marks_obtained = 100
WHERE marks_obtained > 100;

UPDATE marks
SET marks_obtained = 0
WHERE marks_obtained < 0;

UPDATE marks
SET practical_marks = 50
WHERE practical_marks > 50;

UPDATE marks
SET practical_marks = 0
WHERE practical_marks < 0;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
