-- ============================================================
-- KIZAGA RMS: Seed all 14 A-Level combinations from kizaga.txt
-- Supports both old schema (combination_name, description,
-- subject_role) and new schema (name, code, curriculum_id).
-- Idempotent: safe to run multiple times.
-- Run AFTER migration_tables.sql AND fix_curriculum.sql
-- ============================================================

-- ============================================================
-- 1. ENSURE ALL 14 COMBINATIONS EXIST
-- Uses new-schema columns if available, falls back to old
-- ============================================================

-- Add combinations with both new and old column names
DO $$
DECLARE
  v_curriculum_id UUID;
  v_has_name_col  BOOLEAN;
  v_has_code_col  BOOLEAN;
  v_has_combo_name_col BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'combinations' AND column_name = 'name'
  ) INTO v_has_name_col;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'combinations' AND column_name = 'code'
  ) INTO v_has_code_col;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'combinations' AND column_name = 'combination_name'
  ) INTO v_has_combo_name_col;

  -- Get Old Curriculum A-Level ID
  SELECT id INTO v_curriculum_id
  FROM curricula
  WHERE name = 'Old Curriculum A-Level';

  -- Insert all 14 combos
  IF v_has_name_col AND v_has_code_col THEN
    INSERT INTO combinations (name, code, curriculum_id)
    SELECT v.name, v.code, v_curriculum_id
    FROM (VALUES
      ('Physics Chemistry Mathematics',        'PCM'),
      ('Physics Chemistry Biology',            'PCB'),
      ('Chemistry Biology Geography',          'CBG'),
      ('Physics Geography Mathematics',        'PGM'),
      ('Chemistry Biology Agriculture',        'CBA'),
      ('Economics Commerce Accountancy',       'ECA'),
      ('History Geography Economics',          'HGE'),
      ('Economics Geography Accountancy',      'EGA'),
      ('Economics Geography Mathematics',      'EGM'),
      ('History Kiswahili Literature',         'HKL'),
      ('History Geography Kiswahili',          'HGK'),
      ('History Geography Language',           'HGL'),
      ('Kiswahili Literature French',          'KLF'),
      ('History Kiswahili Economics',          'HKE')
    ) AS v(name, code)
    WHERE NOT EXISTS (
      SELECT 1 FROM combinations c WHERE c.code = v.code
    );
  END IF;

  IF v_has_combo_name_col THEN
    INSERT INTO combinations (combination_name, description)
    SELECT v.name, v.desc
    FROM (VALUES
      ('PCM', 'Physics, Chemistry, Advanced Mathematics – Engineering and Technology'),
      ('PCB', 'Physics, Chemistry, Biology – Medicine and Health Sciences'),
      ('CBG', 'Chemistry, Biology, Geography – Environmental and Life Sciences'),
      ('PGM', 'Physics, Geography, Advanced Mathematics – Geomatics and Surveying'),
      ('CBA', 'Chemistry, Biology, Agriculture – Agriculture and Environmental Sciences'),
      ('ECA', 'Economics, Commerce, Accountancy – Business and Finance'),
      ('HGE', 'History, Geography, Economics – Arts and Social Sciences'),
      ('EGA', 'Economics, Geography, Accountancy – Economics and Accountancy'),
      ('EGM', 'Economics, Geography, Advanced Mathematics – Economics and Mathematics'),
      ('HKL', 'History, Kiswahili, Literature – Languages and Literature'),
      ('HGK', 'History, Geography, Kiswahili – Arts and Humanities'),
      ('HGL', 'History, Geography, Language (English/French) – Languages and Social Studies'),
      ('KLF', 'Kiswahili, Literature, French – Modern Languages'),
      ('HKE', 'History, Kiswahili, Economics – History and Economics')
    ) AS v(name, "desc")
    WHERE NOT EXISTS (
      SELECT 1 FROM combinations c WHERE c.combination_name = v.name
    );
  END IF;
END $$;

-- ============================================================
-- 2. SUBJECT-ROLE ASSIGNMENTS PER KIZAGA.TXT
-- Rules:
--   - All combos: 3 CORE subjects
--   - All combos: HISTM (SUBSIDIARY), ACOM (SUBSIDIARY)
--   - CBG, PCB, HGE: BAM is also SUBSIDIARY (compulsory)
--   - Others: BAM is OPTIONAL
--   - All combos: COMP (OPTIONAL), ACCT (OPTIONAL)
-- ============================================================

-- Ensure subject_role column exists (for old-schema pages)
ALTER TABLE combination_subjects
ADD COLUMN IF NOT EXISTS subject_role TEXT
CHECK (subject_role IN ('CORE', 'SUBSIDIARY', 'OPTIONAL'));

-- Delete old assignments to start fresh
DELETE FROM combination_subjects;

-- PCM: Physics(CORE), Chemistry(CORE), Mathematics(CORE),
--      ACOM(SUBSIDIARY), HISTM(SUBSIDIARY),
--      COMP(OPTIONAL), BAM(OPTIONAL), ACCT(OPTIONAL)
INSERT INTO combination_subjects (combination_id, subject_id, subject_role)
SELECT c.id, s.id, roles.role
FROM combinations c, subjects s,
(VALUES
  ('PCM', 'PHY',   'CORE'),
  ('PCM', 'CHEM',  'CORE'),
  ('PCM', 'MATH',  'CORE'),
  ('PCM', 'ACOM',  'SUBSIDIARY'),
  ('PCM', 'HISTM', 'SUBSIDIARY'),
  ('PCM', 'COMP',  'OPTIONAL'),
  ('PCM', 'BAM',   'OPTIONAL'),
  ('PCM', 'ACCT',  'OPTIONAL')
) AS roles(ccode, scode, role)
WHERE (c.code = roles.ccode OR c.combination_name = roles.ccode)
  AND s.subject_code = roles.scode;

-- PCB: Physics(CORE), Chemistry(CORE), Biology(CORE),
--      BAM(SUBSIDIARY), ACOM(SUBSIDIARY), HISTM(SUBSIDIARY),
--      COMP(OPTIONAL), ACCT(OPTIONAL)
INSERT INTO combination_subjects (combination_id, subject_id, subject_role)
SELECT c.id, s.id, roles.role
FROM combinations c, subjects s,
(VALUES
  ('PCB', 'PHY',   'CORE'),
  ('PCB', 'CHEM',  'CORE'),
  ('PCB', 'BIO',   'CORE'),
  ('PCB', 'BAM',   'SUBSIDIARY'),
  ('PCB', 'ACOM',  'SUBSIDIARY'),
  ('PCB', 'HISTM', 'SUBSIDIARY'),
  ('PCB', 'COMP',  'OPTIONAL'),
  ('PCB', 'ACCT',  'OPTIONAL')
) AS roles(ccode, scode, role)
WHERE (c.code = roles.ccode OR c.combination_name = roles.ccode)
  AND s.subject_code = roles.scode;

-- CBG: Chemistry(CORE), Biology(CORE), Geography(CORE),
--      BAM(SUBSIDIARY), ACOM(SUBSIDIARY), HISTM(SUBSIDIARY),
--      COMP(OPTIONAL), ACCT(OPTIONAL)
INSERT INTO combination_subjects (combination_id, subject_id, subject_role)
SELECT c.id, s.id, roles.role
FROM combinations c, subjects s,
(VALUES
  ('CBG', 'CHEM',  'CORE'),
  ('CBG', 'BIO',   'CORE'),
  ('CBG', 'GEOG',  'CORE'),
  ('CBG', 'BAM',   'SUBSIDIARY'),
  ('CBG', 'ACOM',  'SUBSIDIARY'),
  ('CBG', 'HISTM', 'SUBSIDIARY'),
  ('CBG', 'COMP',  'OPTIONAL'),
  ('CBG', 'ACCT',  'OPTIONAL')
) AS roles(ccode, scode, role)
WHERE (c.code = roles.ccode OR c.combination_name = roles.ccode)
  AND s.subject_code = roles.scode;

-- PGM: Physics(CORE), Geography(CORE), Mathematics(CORE),
--      ACOM(SUBSIDIARY), HISTM(SUBSIDIARY),
--      COMP(OPTIONAL), BAM(OPTIONAL), ACCT(OPTIONAL)
INSERT INTO combination_subjects (combination_id, subject_id, subject_role)
SELECT c.id, s.id, roles.role
FROM combinations c, subjects s,
(VALUES
  ('PGM', 'PHY',   'CORE'),
  ('PGM', 'GEOG',  'CORE'),
  ('PGM', 'MATH',  'CORE'),
  ('PGM', 'ACOM',  'SUBSIDIARY'),
  ('PGM', 'HISTM', 'SUBSIDIARY'),
  ('PGM', 'COMP',  'OPTIONAL'),
  ('PGM', 'BAM',   'OPTIONAL'),
  ('PGM', 'ACCT',  'OPTIONAL')
) AS roles(ccode, scode, role)
WHERE (c.code = roles.ccode OR c.combination_name = roles.ccode)
  AND s.subject_code = roles.scode;

-- CBA: Chemistry(CORE), Biology(CORE), Agriculture(CORE),
--      ACOM(SUBSIDIARY), HISTM(SUBSIDIARY),
--      COMP(OPTIONAL), BAM(OPTIONAL), ACCT(OPTIONAL)
INSERT INTO combination_subjects (combination_id, subject_id, subject_role)
SELECT c.id, s.id, roles.role
FROM combinations c, subjects s,
(VALUES
  ('CBA', 'CHEM',  'CORE'),
  ('CBA', 'BIO',   'CORE'),
  ('CBA', 'AGRI',  'CORE'),
  ('CBA', 'ACOM',  'SUBSIDIARY'),
  ('CBA', 'HISTM', 'SUBSIDIARY'),
  ('CBA', 'COMP',  'OPTIONAL'),
  ('CBA', 'BAM',   'OPTIONAL'),
  ('CBA', 'ACCT',  'OPTIONAL')
) AS roles(ccode, scode, role)
WHERE (c.code = roles.ccode OR c.combination_name = roles.ccode)
  AND s.subject_code = roles.scode;

-- ECA: Economics(CORE), Commerce(CORE), Accountancy(CORE),
--      ACOM(SUBSIDIARY), HISTM(SUBSIDIARY),
--      COMP(OPTIONAL), BAM(OPTIONAL)
INSERT INTO combination_subjects (combination_id, subject_id, subject_role)
SELECT c.id, s.id, roles.role
FROM combinations c, subjects s,
(VALUES
  ('ECA', 'ECON',  'CORE'),
  ('ECA', 'COMM',  'CORE'),
  ('ECA', 'ACCT',  'CORE'),
  ('ECA', 'ACOM',  'SUBSIDIARY'),
  ('ECA', 'HISTM', 'SUBSIDIARY'),
  ('ECA', 'COMP',  'OPTIONAL'),
  ('ECA', 'BAM',   'OPTIONAL')
) AS roles(ccode, scode, role)
WHERE (c.code = roles.ccode OR c.combination_name = roles.ccode)
  AND s.subject_code = roles.scode;

-- HGE: History(CORE), Geography(CORE), Economics(CORE),
--      BAM(SUBSIDIARY), ACOM(SUBSIDIARY), HISTM(SUBSIDIARY),
--      COMP(OPTIONAL), ACCT(OPTIONAL)
INSERT INTO combination_subjects (combination_id, subject_id, subject_role)
SELECT c.id, s.id, roles.role
FROM combinations c, subjects s,
(VALUES
  ('HGE', 'HIST',  'CORE'),
  ('HGE', 'GEOG',  'CORE'),
  ('HGE', 'ECON',  'CORE'),
  ('HGE', 'BAM',   'SUBSIDIARY'),
  ('HGE', 'ACOM',  'SUBSIDIARY'),
  ('HGE', 'HISTM', 'SUBSIDIARY'),
  ('HGE', 'COMP',  'OPTIONAL'),
  ('HGE', 'ACCT',  'OPTIONAL')
) AS roles(ccode, scode, role)
WHERE (c.code = roles.ccode OR c.combination_name = roles.ccode)
  AND s.subject_code = roles.scode;

-- EGA: Economics(CORE), Geography(CORE), Accountancy(CORE),
--      ACOM(SUBSIDIARY), HISTM(SUBSIDIARY),
--      COMP(OPTIONAL), BAM(OPTIONAL)
INSERT INTO combination_subjects (combination_id, subject_id, subject_role)
SELECT c.id, s.id, roles.role
FROM combinations c, subjects s,
(VALUES
  ('EGA', 'ECON',  'CORE'),
  ('EGA', 'GEOG',  'CORE'),
  ('EGA', 'ACCT',  'CORE'),
  ('EGA', 'ACOM',  'SUBSIDIARY'),
  ('EGA', 'HISTM', 'SUBSIDIARY'),
  ('EGA', 'COMP',  'OPTIONAL'),
  ('EGA', 'BAM',   'OPTIONAL')
) AS roles(ccode, scode, role)
WHERE (c.code = roles.ccode OR c.combination_name = roles.ccode)
  AND s.subject_code = roles.scode;

-- EGM: Economics(CORE), Geography(CORE), Mathematics(CORE),
--      ACOM(SUBSIDIARY), HISTM(SUBSIDIARY),
--      COMP(OPTIONAL), BAM(OPTIONAL), ACCT(OPTIONAL)
INSERT INTO combination_subjects (combination_id, subject_id, subject_role)
SELECT c.id, s.id, roles.role
FROM combinations c, subjects s,
(VALUES
  ('EGM', 'ECON',  'CORE'),
  ('EGM', 'GEOG',  'CORE'),
  ('EGM', 'MATH',  'CORE'),
  ('EGM', 'ACOM',  'SUBSIDIARY'),
  ('EGM', 'HISTM', 'SUBSIDIARY'),
  ('EGM', 'COMP',  'OPTIONAL'),
  ('EGM', 'BAM',   'OPTIONAL'),
  ('EGM', 'ACCT',  'OPTIONAL')
) AS roles(ccode, scode, role)
WHERE (c.code = roles.ccode OR c.combination_name = roles.ccode)
  AND s.subject_code = roles.scode;

-- HKL: History(CORE), Kiswahili(CORE), Literature(CORE),
--      ACOM(SUBSIDIARY), HISTM(SUBSIDIARY),
--      COMP(OPTIONAL), BAM(OPTIONAL), ACCT(OPTIONAL)
INSERT INTO combination_subjects (combination_id, subject_id, subject_role)
SELECT c.id, s.id, roles.role
FROM combinations c, subjects s,
(VALUES
  ('HKL', 'HIST', 'CORE'),
  ('HKL', 'KISW', 'CORE'),
  ('HKL', 'LITE', 'CORE'),
  ('HKL', 'ACOM',  'SUBSIDIARY'),
  ('HKL', 'HISTM', 'SUBSIDIARY'),
  ('HKL', 'COMP',  'OPTIONAL'),
  ('HKL', 'BAM',   'OPTIONAL'),
  ('HKL', 'ACCT',  'OPTIONAL')
) AS roles(ccode, scode, role)
WHERE (c.code = roles.ccode OR c.combination_name = roles.ccode)
  AND s.subject_code = roles.scode;

-- HGK: History(CORE), Geography(CORE), Kiswahili(CORE),
--      ACOM(SUBSIDIARY), HISTM(SUBSIDIARY),
--      COMP(OPTIONAL), BAM(OPTIONAL), ACCT(OPTIONAL)
INSERT INTO combination_subjects (combination_id, subject_id, subject_role)
SELECT c.id, s.id, roles.role
FROM combinations c, subjects s,
(VALUES
  ('HGK', 'HIST', 'CORE'),
  ('HGK', 'GEOG', 'CORE'),
  ('HGK', 'KISW', 'CORE'),
  ('HGK', 'ACOM',  'SUBSIDIARY'),
  ('HGK', 'HISTM', 'SUBSIDIARY'),
  ('HGK', 'COMP',  'OPTIONAL'),
  ('HGK', 'BAM',   'OPTIONAL'),
  ('HGK', 'ACCT',  'OPTIONAL')
) AS roles(ccode, scode, role)
WHERE (c.code = roles.ccode OR c.combination_name = roles.ccode)
  AND s.subject_code = roles.scode;

-- HGL: History(CORE), Geography(CORE), Language(CORE),
--      ACOM(SUBSIDIARY), HISTM(SUBSIDIARY),
--      COMP(OPTIONAL), BAM(OPTIONAL), ACCT(OPTIONAL)
INSERT INTO combination_subjects (combination_id, subject_id, subject_role)
SELECT c.id, s.id, roles.role
FROM combinations c, subjects s,
(VALUES
  ('HGL', 'HIST', 'CORE'),
  ('HGL', 'GEOG', 'CORE'),
  ('HGL', 'LANG', 'CORE'),
  ('HGL', 'ACOM',  'SUBSIDIARY'),
  ('HGL', 'HISTM', 'SUBSIDIARY'),
  ('HGL', 'COMP',  'OPTIONAL'),
  ('HGL', 'BAM',   'OPTIONAL'),
  ('HGL', 'ACCT',  'OPTIONAL')
) AS roles(ccode, scode, role)
WHERE (c.code = roles.ccode OR c.combination_name = roles.ccode)
  AND s.subject_code = roles.scode;

-- KLF: Kiswahili(CORE), Literature(CORE), French(CORE),
--      ACOM(SUBSIDIARY), HISTM(SUBSIDIARY),
--      COMP(OPTIONAL), BAM(OPTIONAL), ACCT(OPTIONAL)
INSERT INTO combination_subjects (combination_id, subject_id, subject_role)
SELECT c.id, s.id, roles.role
FROM combinations c, subjects s,
(VALUES
  ('KLF', 'KISW', 'CORE'),
  ('KLF', 'LITE', 'CORE'),
  ('KLF', 'FREN', 'CORE'),
  ('KLF', 'ACOM',  'SUBSIDIARY'),
  ('KLF', 'HISTM', 'SUBSIDIARY'),
  ('KLF', 'COMP',  'OPTIONAL'),
  ('KLF', 'BAM',   'OPTIONAL'),
  ('KLF', 'ACCT',  'OPTIONAL')
) AS roles(ccode, scode, role)
WHERE (c.code = roles.ccode OR c.combination_name = roles.ccode)
  AND s.subject_code = roles.scode;

-- HKE: History(CORE), Kiswahili(CORE), Economics(CORE),
--      ACOM(SUBSIDIARY), HISTM(SUBSIDIARY),
--      COMP(OPTIONAL), BAM(OPTIONAL), ACCT(OPTIONAL)
INSERT INTO combination_subjects (combination_id, subject_id, subject_role)
SELECT c.id, s.id, roles.role
FROM combinations c, subjects s,
(VALUES
  ('HKE', 'HIST', 'CORE'),
  ('HKE', 'KISW', 'CORE'),
  ('HKE', 'ECON', 'CORE'),
  ('HKE', 'ACOM',  'SUBSIDIARY'),
  ('HKE', 'HISTM', 'SUBSIDIARY'),
  ('HKE', 'COMP',  'OPTIONAL'),
  ('HKE', 'BAM',   'OPTIONAL'),
  ('HKE', 'ACCT',  'OPTIONAL')
) AS roles(ccode, scode, role)
WHERE (c.code = roles.ccode OR c.combination_name = roles.ccode)
  AND s.subject_code = roles.scode;

-- ============================================================
-- VERIFICATION (uncomment to check)
-- ============================================================
-- SELECT
--   COALESCE(c.code, c.combination_name) AS combo,
--   s.subject_code,
--   s.subject_name,
--   cs.subject_role
-- FROM combinations c
-- JOIN combination_subjects cs ON cs.combination_id = c.id
-- JOIN subjects s ON s.id = cs.subject_id
-- ORDER BY combo, cs.subject_role, s.subject_code;
