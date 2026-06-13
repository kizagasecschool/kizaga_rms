-- ============================================================
-- CURRICULUM-AWARE SUBJECT ASSIGNMENTS
-- Cleanup & idempotent migration: run AFTER fix_curriculum.sql
-- and migration_subjects_curriculum.sql
-- ============================================================

-- 1. Remove subject_assignments where subject has a specific
--    curriculum that does NOT match the class's curriculum.
--    Subjects with NULL curriculum are available in both.
DELETE FROM subject_assignments sa
USING subjects s, class_curricula cc, curricula cu
WHERE s.id = sa.subject_id
  AND cc.class_id = sa.class_id
  AND cu.id = cc.curriculum_id
  AND s.curriculum IS NOT NULL
  AND (
    (cu.name LIKE 'New%' AND s.curriculum != 'NEW')
    OR
    (cu.name LIKE 'Old%' AND s.curriculum != 'OLD')
  );

-- 2. Insert missing subject_assignments for subjects that
--    match the class's curriculum (NULL = both curricula)
INSERT INTO subject_assignments (subject_id, class_id)
SELECT s.id, cc.class_id
FROM subjects s
JOIN class_curricula cc ON TRUE
JOIN curricula cu ON cu.id = cc.curriculum_id
WHERE s.level = 'O_LEVEL'
  AND (
    s.curriculum IS NULL
    OR (cu.name LIKE 'New%' AND s.curriculum = 'NEW')
    OR (cu.name LIKE 'Old%' AND s.curriculum = 'OLD')
  )
  AND NOT EXISTS (
    SELECT 1 FROM subject_assignments sa
    WHERE sa.subject_id = s.id AND sa.class_id = cc.class_id
  )
ON CONFLICT (subject_id, class_id) DO NOTHING;

-- 3. For classes with NO curriculum, keep all existing assignments
