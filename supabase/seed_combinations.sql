-- ============================================================
-- KIZAGA RMS: Seed A-Level Subjects, Combinations & Assignments
-- Based on kizaga.txt curriculum data
-- Run this AFTER migration_tables.sql AND migration_subjects_curriculum.sql
-- Idempotent: safe to run multiple times
-- ============================================================

-- ============================================================
-- 1. A-LEVEL SUBJECTS
-- ============================================================
INSERT INTO subjects (subject_code, subject_name, subject_type, level)
SELECT v.code, v.name, v.type, 'A_LEVEL'
FROM (VALUES
  -- Core academic subjects
  ('PHY',   'Physics',                            'COMPULSORY'),
  ('CHEM',  'Chemistry',                          'COMPULSORY'),
  ('BIO',   'Biology',                            'COMPULSORY'),
  ('MATH',  'Advanced Mathematics',                'COMPULSORY'),
  ('GEOG',  'Geography',                          'COMPULSORY'),
  ('AGRI',  'Agriculture',                        'COMPULSORY'),
  ('HIST',  'History',                            'COMPULSORY'),
  ('KISW',  'Kiswahili',                          'COMPULSORY'),
  ('LITE',  'Literature in English',              'COMPULSORY'),
  ('LANG',  'Language (English/French)',          'COMPULSORY'),
  ('FREN',  'French',                             'COMPULSORY'),
  ('ECON',  'Economics',                          'COMPULSORY'),
  ('COMM',  'Commerce',                           'COMPULSORY'),
  ('ACCT',  'Accountancy',                        'COMPULSORY'),

  -- Subsidiary subjects
  ('BAM',   'Basic Applied Mathematics',          'ELECTIVE'),
  ('ACOM',  'Academic Communication',             'ELECTIVE'),
  ('HISTM', 'Historia ya Tanzania na Maadili',    'ELECTIVE'),
  ('COMP',  'Computer Science',                   'ELECTIVE')
) AS v(code, name, type)
WHERE NOT EXISTS (
  SELECT 1 FROM subjects s WHERE s.subject_code = v.code
)
ON CONFLICT (subject_code) DO NOTHING;

-- ============================================================
-- 2. A-LEVEL COMBINATIONS
-- ============================================================
INSERT INTO combinations (combination_name, description)
SELECT v.name, v."desc"
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
WHERE NOT EXISTS (SELECT 1 FROM combinations);

-- ============================================================
-- 3. COMBINATION-SUBJECT ASSIGNMENTS
-- ============================================================

-- Helper: Get subject ID by code
-- (Using subqueries so this works regardless of actual UUIDs)

-- PCM: Physics(CORE), Chemistry(CORE), Mathematics(CORE), ACOM(SUBSIDIARY), HISTM(SUBSIDIARY)
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
) AS roles(cname, scode, role)
WHERE c.combination_name = roles.cname AND s.subject_code = roles.scode
AND NOT EXISTS (
  SELECT 1 FROM combination_subjects cs
  WHERE cs.combination_id = c.id AND cs.subject_id = s.id
);

-- PCB: Physics(CORE), Chemistry(CORE), Biology(CORE), BAM(SUBSIDIARY), ACOM(SUBSIDIARY), HISTM(SUBSIDIARY)
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
) AS roles(cname, scode, role)
WHERE c.combination_name = roles.cname AND s.subject_code = roles.scode
AND NOT EXISTS (
  SELECT 1 FROM combination_subjects cs
  WHERE cs.combination_id = c.id AND cs.subject_id = s.id
);

-- CBG: Chemistry(CORE), Biology(CORE), Geography(CORE), BAM(SUBSIDIARY), ACOM(SUBSIDIARY), HISTM(SUBSIDIARY)
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
) AS roles(cname, scode, role)
WHERE c.combination_name = roles.cname AND s.subject_code = roles.scode
AND NOT EXISTS (
  SELECT 1 FROM combination_subjects cs
  WHERE cs.combination_id = c.id AND cs.subject_id = s.id
);

-- PGM: Physics(CORE), Geography(CORE), Mathematics(CORE), ACOM(SUBSIDIARY), HISTM(SUBSIDIARY)
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
) AS roles(cname, scode, role)
WHERE c.combination_name = roles.cname AND s.subject_code = roles.scode
AND NOT EXISTS (
  SELECT 1 FROM combination_subjects cs
  WHERE cs.combination_id = c.id AND cs.subject_id = s.id
);

-- CBA: Chemistry(CORE), Biology(CORE), Agriculture(CORE), ACOM(SUBSIDIARY), HISTM(SUBSIDIARY)
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
) AS roles(cname, scode, role)
WHERE c.combination_name = roles.cname AND s.subject_code = roles.scode
AND NOT EXISTS (
  SELECT 1 FROM combination_subjects cs
  WHERE cs.combination_id = c.id AND cs.subject_id = s.id
);

-- ECA: Economics(CORE), Commerce(CORE), Accountancy(CORE), ACOM(SUBSIDIARY), HISTM(SUBSIDIARY)
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
) AS roles(cname, scode, role)
WHERE c.combination_name = roles.cname AND s.subject_code = roles.scode
AND NOT EXISTS (
  SELECT 1 FROM combination_subjects cs
  WHERE cs.combination_id = c.id AND cs.subject_id = s.id
);

-- HGE: History(CORE), Geography(CORE), Economics(CORE), BAM(SUBSIDIARY), ACOM(SUBSIDIARY), HISTM(SUBSIDIARY)
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
) AS roles(cname, scode, role)
WHERE c.combination_name = roles.cname AND s.subject_code = roles.scode
AND NOT EXISTS (
  SELECT 1 FROM combination_subjects cs
  WHERE cs.combination_id = c.id AND cs.subject_id = s.id
);

-- EGA: Economics(CORE), Geography(CORE), Accountancy(CORE), ACOM(SUBSIDIARY), HISTM(SUBSIDIARY)
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
) AS roles(cname, scode, role)
WHERE c.combination_name = roles.cname AND s.subject_code = roles.scode
AND NOT EXISTS (
  SELECT 1 FROM combination_subjects cs
  WHERE cs.combination_id = c.id AND cs.subject_id = s.id
);

-- EGM: Economics(CORE), Geography(CORE), Mathematics(CORE), ACOM(SUBSIDIARY), HISTM(SUBSIDIARY)
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
) AS roles(cname, scode, role)
WHERE c.combination_name = roles.cname AND s.subject_code = roles.scode
AND NOT EXISTS (
  SELECT 1 FROM combination_subjects cs
  WHERE cs.combination_id = c.id AND cs.subject_id = s.id
);

-- HKL: History(CORE), Kiswahili(CORE), Literature(CORE), ACOM(SUBSIDIARY), HISTM(SUBSIDIARY)
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
) AS roles(cname, scode, role)
WHERE c.combination_name = roles.cname AND s.subject_code = roles.scode
AND NOT EXISTS (
  SELECT 1 FROM combination_subjects cs
  WHERE cs.combination_id = c.id AND cs.subject_id = s.id
);

-- HGK: History(CORE), Geography(CORE), Kiswahili(CORE), ACOM(SUBSIDIARY), HISTM(SUBSIDIARY)
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
) AS roles(cname, scode, role)
WHERE c.combination_name = roles.cname AND s.subject_code = roles.scode
AND NOT EXISTS (
  SELECT 1 FROM combination_subjects cs
  WHERE cs.combination_id = c.id AND cs.subject_id = s.id
);

-- HGL: History(CORE), Geography(CORE), Language(CORE), ACOM(SUBSIDIARY), HISTM(SUBSIDIARY)
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
) AS roles(cname, scode, role)
WHERE c.combination_name = roles.cname AND s.subject_code = roles.scode
AND NOT EXISTS (
  SELECT 1 FROM combination_subjects cs
  WHERE cs.combination_id = c.id AND cs.subject_id = s.id
);

-- KLF: Kiswahili(CORE), Literature(CORE), French(CORE), ACOM(SUBSIDIARY), HISTM(SUBSIDIARY)
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
) AS roles(cname, scode, role)
WHERE c.combination_name = roles.cname AND s.subject_code = roles.scode
AND NOT EXISTS (
  SELECT 1 FROM combination_subjects cs
  WHERE cs.combination_id = c.id AND cs.subject_id = s.id
);

-- HKE: History(CORE), Kiswahili(CORE), Economics(CORE), ACOM(SUBSIDIARY), HISTM(SUBSIDIARY)
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
) AS roles(cname, scode, role)
WHERE c.combination_name = roles.cname AND s.subject_code = roles.scode
AND NOT EXISTS (
  SELECT 1 FROM combination_subjects cs
  WHERE cs.combination_id = c.id AND cs.subject_id = s.id
);

-- ============================================================
-- VERIFICATION QUERIES (uncomment to check)
-- ============================================================
-- SELECT c.combination_name, s.subject_code, s.subject_name, cs.subject_role
-- FROM combinations c
-- JOIN combination_subjects cs ON cs.combination_id = c.id
-- JOIN subjects s ON s.id = cs.subject_id
-- ORDER BY c.combination_name, cs.subject_role, s.subject_code;

-- ============================================================
-- END
-- ============================================================
