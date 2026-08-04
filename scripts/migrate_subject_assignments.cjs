/**
 * Migration: Change subject_assignments from class_stream_id to class_id
 *
 * Run this SQL in Supabase Dashboard > SQL Editor
 */
const sql = `
-- Add class_id column
ALTER TABLE subject_assignments ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE CASCADE;

-- Migrate existing data (convert class_stream_id to class_id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subject_assignments' AND column_name = 'class_stream_id') THEN
    UPDATE subject_assignments sa
    SET class_id = cs.class_id
    FROM class_streams cs
    WHERE sa.class_stream_id = cs.id
      AND sa.class_id IS NULL;
  END IF;
END $$;

-- Drop old column and constraint
ALTER TABLE subject_assignments DROP CONSTRAINT IF EXISTS subject_assignments_class_stream_id_fkey;
ALTER TABLE subject_assignments DROP CONSTRAINT IF EXISTS uq_subject_assignment;
DROP INDEX IF EXISTS idx_subject_assignments_class_stream;
ALTER TABLE subject_assignments DROP COLUMN IF EXISTS class_stream_id;

-- Create new indexes and constraints
CREATE INDEX IF NOT EXISTS idx_subject_assignments_class ON subject_assignments(class_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_subject_assignment') THEN
    ALTER TABLE subject_assignments ADD CONSTRAINT uq_subject_assignment UNIQUE (subject_id, class_id);
  END IF;
END $$;

-- Also need to make class_id NOT NULL (after migration)
ALTER TABLE subject_assignments ALTER COLUMN class_id SET NOT NULL;
`

console.log('=== Run this SQL in Supabase Dashboard > SQL Editor ===\n')
console.log(sql)
