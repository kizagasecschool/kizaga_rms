-- ============================================================
-- Fix corrupted subjects.curriculum values
--
-- The Subjects form was defaulting new subjects to 'OLD' and
-- replacing NULL with 'OLD' on edit, corrupting the curriculum
-- tag for shared subjects.
--
-- Fixes:
--   Shared subjects (KISW_O, ENGL_O, MATH_O, CIV_O, BIO_O,
--     CHEM_O, PHY_O, GEO_O, HIST_O) → NULL
--   BK_O  → 'OLD'
--   IT_O  → 'NEW'
-- ============================================================

-- Reset shared/compulsory subjects back to NULL (shared between curricula)
UPDATE subjects
SET curriculum = NULL
WHERE subject_code IN (
  'KISW_O', 'ENGL_O', 'MATH_O', 'CIV_O',
  'BIO_O',  'CHEM_O', 'PHY_O',  'GEO_O', 'HIST_O'
)
AND curriculum IS DISTINCT FROM NULL;

-- Ensure BK_O is 'OLD' (old curriculum only)
UPDATE subjects
SET curriculum = 'OLD'
WHERE subject_code = 'BK_O'
AND curriculum IS DISTINCT FROM 'OLD';

-- Ensure IT_O is 'NEW' (new curriculum only)
UPDATE subjects
SET curriculum = 'NEW'
WHERE subject_code = 'IT_O'
AND curriculum IS DISTINCT FROM 'NEW';

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
