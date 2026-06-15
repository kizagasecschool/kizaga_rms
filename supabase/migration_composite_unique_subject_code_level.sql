-- ============================================================
-- Change unique constraint on subjects from (subject_code)
-- to (subject_code, level), so the same code can exist at
-- O_LEVEL and A_LEVEL as separate rows.
-- ============================================================

-- 1. First check for any existing duplicates that would break
--    the new constraint (shouldn't exist, but safety first)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM (
      SELECT subject_code, level, COUNT(*) AS cnt
      FROM subjects
      GROUP BY subject_code, level
      HAVING COUNT(*) > 1
    ) dup
  ) THEN
    RAISE EXCEPTION 'Cannot migrate: duplicate (subject_code, level) pairs exist. Resolve manually first.';
  END IF;
END $$;

-- 2. Drop old unique constraint on subject_code alone
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_subject_code_key;

-- 3. (Rename existing index to avoid confusion)
DROP INDEX IF EXISTS idx_subjects_code;
DROP INDEX IF EXISTS idx_subjects_level;

-- 4. Add new composite unique constraint
ALTER TABLE subjects ADD CONSTRAINT subjects_subject_code_level_key UNIQUE (subject_code, level);

-- 5. Re-create helper indexes
CREATE INDEX IF NOT EXISTS idx_subjects_code  ON subjects(subject_code);
CREATE INDEX IF NOT EXISTS idx_subjects_level ON subjects(level);
