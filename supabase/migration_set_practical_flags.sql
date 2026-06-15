-- ============================================================
-- Set has_practical = TRUE for science subjects
-- Chemistry, Biology, Physics have practical components
-- ============================================================

UPDATE subjects SET has_practical = TRUE
WHERE UPPER(subject_code) IN ('CHEM', 'PHY', 'BIOS', 'BIO', 'BIOLOGY')
   OR (level = 'A_LEVEL' AND UPPER(subject_code) IN ('CHEM', 'PHY', 'BIO'));

-- All other O-Level subjects: no practical
UPDATE subjects SET has_practical = FALSE
WHERE level = 'O_LEVEL'
  AND UPPER(subject_code) NOT IN ('CHEM', 'PHY', 'BIOS', 'BIO', 'BIOLOGY')
  AND has_practical;

NOTIFY pgrst, 'reload schema';
