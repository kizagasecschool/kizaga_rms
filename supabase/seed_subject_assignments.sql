-- ============================================================
-- SEED: O-Level Subjects + Subject→Class Assignments
--        A-Level Combination→Subject + Class→Combination
-- Idempotent: safe to run multiple times
-- Run this AFTER migration_tables.sql AND fix_curriculum.sql
-- ============================================================

-- ============================================================
-- 1. O-LEVEL SUBJECTS
-- Standard Tanzanian secondary school O-Level subjects.
-- Uses _O suffix to avoid UNIQUE subject_code conflicts with
-- existing A-Level subjects (KISW, BIO, CHEM, etc.)
-- ============================================================
INSERT INTO subjects (subject_code, subject_name, subject_type, level)
SELECT v.code, v.name, v.type, 'O_LEVEL'
FROM (VALUES
  ('KISW_O', 'Kiswahili (O-Level)',          'COMPULSORY'),
  ('ENGL_O', 'English Language (O-Level)',    'COMPULSORY'),
  ('MATH_O', 'Mathematics (O-Level)',         'COMPULSORY'),
  ('CIV_O',  'Civics (O-Level)',             'COMPULSORY'),
  ('BIO_O',  'Biology (O-Level)',            'COMPULSORY'),
  ('CHEM_O', 'Chemistry (O-Level)',          'COMPULSORY'),
  ('PHY_O',  'Physics (O-Level)',            'COMPULSORY'),
  ('GEO_O',  'Geography (O-Level)',          'COMPULSORY'),
  ('HIST_O', 'History (O-Level)',            'COMPULSORY'),
  ('BK_O',   'Bible Knowledge (O-Level)',    'OPTIONAL'),
  ('IT_O',   'Information Technology (O-Level)', 'OPTIONAL')
) AS v(code, name, type)
WHERE NOT EXISTS (
  SELECT 1 FROM subjects s WHERE s.subject_code = v.code
)
ON CONFLICT (subject_code) DO NOTHING;

-- ============================================================
-- 2. A-LEVEL SUBJECTS (if not already seeded)
-- These match the common A-Level subject set.
-- ============================================================
INSERT INTO subjects (subject_code, subject_name, subject_type, level)
SELECT v.code, v.name, v.type, 'A_LEVEL'
FROM (VALUES
  ('PHY',   'Physics',                       'COMPULSORY'),
  ('CHEM',  'Chemistry',                     'COMPULSORY'),
  ('BIO',   'Biology',                       'COMPULSORY'),
  ('MATH',  'Advanced Mathematics',           'COMPULSORY'),
  ('GEOG',  'Geography',                     'COMPULSORY'),
  ('AGRI',  'Agriculture',                   'COMPULSORY'),
  ('HIST',  'History',                       'COMPULSORY'),
  ('KISW',  'Kiswahili',                     'COMPULSORY'),
  ('LITE',  'Literature in English',         'COMPULSORY'),
  ('LANG',  'Language (English/French)',     'COMPULSORY'),
  ('FREN',  'French',                        'COMPULSORY'),
  ('ECON',  'Economics',                     'COMPULSORY'),
  ('COMM',  'Commerce',                      'COMPULSORY'),
  ('ACCT',  'Accountancy',                   'COMPULSORY'),
  ('BAM',   'Basic Applied Mathematics',     'ELECTIVE'),
  ('ACOM',  'Academic Communication',        'ELECTIVE'),
  ('HISTM', 'Historia ya Tanzania na Maadili','ELECTIVE'),
  ('COMP',  'Computer Science',              'ELECTIVE')
) AS v(code, name, type)
WHERE NOT EXISTS (
  SELECT 1 FROM subjects s WHERE s.subject_code = v.code
)
ON CONFLICT (subject_code) DO NOTHING;

-- ============================================================
-- 3. O-LEVEL: SUBJECT → CLASS ASSIGNMENTS
-- Assign core subjects to Form 1–4.
-- Optional subjects (BK_O, IT_O) assigned to all forms too.
-- ============================================================
WITH class_ids AS (
  SELECT id, class_name FROM classes WHERE class_name IN ('Form 1','Form 2','Form 3','Form 4')
),
subject_ids AS (
  SELECT id, subject_code FROM subjects WHERE level = 'O_LEVEL'
)
INSERT INTO subject_assignments (subject_id, class_id)
SELECT s.id, c.id
FROM subject_ids s
CROSS JOIN class_ids c
WHERE NOT EXISTS (
  SELECT 1 FROM subject_assignments sa
  WHERE sa.subject_id = s.id AND sa.class_id = c.id
);

-- ============================================================
-- 4. A-LEVEL: COMBINATION → SUBJECT ASSIGNMENTS
-- Assigns subjects to each combination based on standard
-- Tanzanian A-Level subject combinations.
-- Uses the new schema (name, code, curriculum_id).
-- ============================================================

-- PCM: Physics, Chemistry, Advanced Mathematics
INSERT INTO combination_subjects (combination_id, subject_id)
SELECT c.id, s.id
FROM combinations c, subjects s
WHERE c.code = 'PCM' AND s.subject_code IN ('PHY', 'CHEM', 'MATH', 'ACOM', 'HISTM')
AND NOT EXISTS (SELECT 1 FROM combination_subjects cs WHERE cs.combination_id = c.id AND cs.subject_id = s.id);

-- PCB: Physics, Chemistry, Biology
INSERT INTO combination_subjects (combination_id, subject_id)
SELECT c.id, s.id
FROM combinations c, subjects s
WHERE c.code = 'PCB' AND s.subject_code IN ('PHY', 'CHEM', 'BIO', 'BAM', 'ACOM')
AND NOT EXISTS (SELECT 1 FROM combination_subjects cs WHERE cs.combination_id = c.id AND cs.subject_id = s.id);

-- HGL: History, Geography, Literature (Language)
INSERT INTO combination_subjects (combination_id, subject_id)
SELECT c.id, s.id
FROM combinations c, subjects s
WHERE c.code = 'HGL' AND s.subject_code IN ('HIST', 'GEOG', 'LANG', 'ACOM', 'HISTM')
AND NOT EXISTS (SELECT 1 FROM combination_subjects cs WHERE cs.combination_id = c.id AND cs.subject_id = s.id);

-- EGM: Economics, Geography, Advanced Mathematics
INSERT INTO combination_subjects (combination_id, subject_id)
SELECT c.id, s.id
FROM combinations c, subjects s
WHERE c.code = 'EGM' AND s.subject_code IN ('ECON', 'GEOG', 'MATH', 'ACOM', 'HISTM')
AND NOT EXISTS (SELECT 1 FROM combination_subjects cs WHERE cs.combination_id = c.id AND cs.subject_id = s.id);

-- CBG: Chemistry, Biology, Geography
INSERT INTO combination_subjects (combination_id, subject_id)
SELECT c.id, s.id
FROM combinations c, subjects s
WHERE c.code = 'CBG' AND s.subject_code IN ('CHEM', 'BIO', 'GEOG', 'BAM', 'ACOM')
AND NOT EXISTS (SELECT 1 FROM combination_subjects cs WHERE cs.combination_id = c.id AND cs.subject_id = s.id);

-- PAM: Physics, Advanced Mathematics
INSERT INTO combination_subjects (combination_id, subject_id)
SELECT c.id, s.id
FROM combinations c, subjects s
WHERE c.code = 'PAM' AND s.subject_code IN ('PHY', 'MATH', 'COMP', 'ACOM', 'HISTM')
AND NOT EXISTS (SELECT 1 FROM combination_subjects cs WHERE cs.combination_id = c.id AND cs.subject_id = s.id);

-- ============================================================
-- 5. A-LEVEL: CLASS → COMBINATION ASSIGNMENTS
-- Assign combinations to Form 5 and Form 6.
-- ============================================================
INSERT INTO class_combinations (class_id, combination_id)
SELECT c.id, combo.id
FROM classes c
CROSS JOIN combinations combo
WHERE c.class_name IN ('Form 5', 'Form 6')
AND NOT EXISTS (
  SELECT 1 FROM class_combinations cc
  WHERE cc.class_id = c.id AND cc.combination_id = combo.id
);

-- ============================================================
-- 6. CREATE CLASS_STREAMS if not already done
-- (6 classes × 5 streams = 30 class_streams)
-- ============================================================
INSERT INTO class_streams (class_id, stream_id)
SELECT c.id, s.id
FROM classes c
CROSS JOIN streams s
WHERE NOT EXISTS (
  SELECT 1 FROM class_streams cs
  WHERE cs.class_id = c.id AND cs.stream_id = s.id
);
