-- Seed marks for PRE-NECTA exam (Form 5, A-Level)
-- Exam ID:  46a65fcb-b90b-4a7a-a33f-e060bab6b94d
-- Class ID: 31c3502b-d57e-4db7-b625-3dfe6f35b63c
--
-- Rules:
--   Theory:    out of 100  (range ~25-95 per subject, realistic A-Level spread)
--   Practical: out of 50   (BIOS and CHEM only; range ~12-48)
--   Test student (2a5e1591-...) is excluded.
--   ON CONFLICT DO NOTHING preserves the 8 marks already entered manually.

-- Fix random seed so values are reproducible
SELECT setseed(0.7341);

INSERT INTO marks (exam_id, student_id, subject_id, marks_obtained, practical_marks, is_absent, created_at, updated_at)
SELECT
  '46a65fcb-b90b-4a7a-a33f-e060bab6b94d'                   AS exam_id,
  s.id                                                       AS student_id,
  sub.id                                                     AS subject_id,
  -- Theory: base 28, spread 67  → range 28-95  (mean ~62)
  ROUND((28 + random() * 67)::numeric, 2)                   AS marks_obtained,
  -- Practical: only for subjects with has_practical=true
  CASE WHEN sub.has_practical
    THEN ROUND((12 + random() * 36)::numeric, 2)
    ELSE NULL
  END                                                        AS practical_marks,
  FALSE                                                      AS is_absent,
  NOW()                                                      AS created_at,
  NOW()                                                      AS updated_at
FROM students s
JOIN student_subjects ss  ON ss.student_id = s.id
JOIN subjects sub         ON sub.id = ss.subject_id
WHERE
  s.class_id = '31c3502b-d57e-4db7-b625-3dfe6f35b63c'
  AND s.status = 'active'
  AND s.id    != '2a5e1591-6abc-4a41-875e-ddea4cfa89fb'   -- exclude TEST student
  AND sub.level = 'A_LEVEL'
ON CONFLICT (exam_id, student_id, subject_id) DO NOTHING;

-- Verify
SELECT
  sub.subject_code,
  sub.subject_name,
  COUNT(*)                               AS students_with_marks,
  ROUND(AVG(m.marks_obtained), 1)       AS avg_theory,
  ROUND(MIN(m.marks_obtained), 1)       AS min_theory,
  ROUND(MAX(m.marks_obtained), 1)       AS max_theory,
  ROUND(AVG(m.practical_marks), 1)      AS avg_practical
FROM marks m
JOIN subjects sub ON sub.id = m.subject_id
WHERE m.exam_id = '46a65fcb-b90b-4a7a-a33f-e060bab6b94d'
GROUP BY sub.id, sub.subject_code, sub.subject_name
ORDER BY sub.subject_name;
