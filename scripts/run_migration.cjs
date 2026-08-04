/**
 * Run this in Supabase SQL Editor (Dashboard > SQL Editor)
 * Or: node scripts/run_migration.cjs (requires DB credentials)
 *
 * Required SQL to create student_subjects table:
 */

const sql = `
-- ============================================================
-- STUDENT_SUBJECTS TABLE
-- Links students to the subjects they take.
-- Enables tracking optional/elective subject choices per student.
-- ============================================================
CREATE TABLE IF NOT EXISTS student_subjects (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE student_subjects ADD COLUMN IF NOT EXISTS student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE student_subjects ADD COLUMN IF NOT EXISTS subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE student_subjects ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE student_subjects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_student_subjects_student ON student_subjects(student_id);
CREATE INDEX IF NOT EXISTS idx_student_subjects_subject ON student_subjects(subject_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_student_subject') THEN
    ALTER TABLE student_subjects ADD CONSTRAINT uq_student_subject UNIQUE (student_id, subject_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_student_subjects_updated_at ON student_subjects;
CREATE TRIGGER trg_student_subjects_updated_at
  BEFORE UPDATE ON student_subjects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE student_subjects ENABLE ROW LEVEL SECURITY;

-- RLS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_student_subjects' AND tablename = 'student_subjects') THEN
    CREATE POLICY "admin_all_student_subjects" ON student_subjects FOR ALL USING (get_my_role() = 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'headmaster_read_student_subjects' AND tablename = 'student_subjects') THEN
    CREATE POLICY "headmaster_read_student_subjects" ON student_subjects FOR SELECT USING (get_my_role() = 'headmaster');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academic_rw_student_subjects' AND tablename = 'student_subjects') THEN
    CREATE POLICY "academic_rw_student_subjects" ON student_subjects FOR ALL USING (get_my_role() = 'academic');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'teacher_read_student_subjects' AND tablename = 'student_subjects') THEN
    CREATE POLICY "teacher_read_student_subjects" ON student_subjects FOR SELECT USING (
      get_my_role() = 'teacher'
      AND student_id IN (
        SELECT s.id FROM students s
        JOIN class_streams cs ON cs.id = s.class_stream_id
        JOIN teacher_subjects ts ON ts.class_stream_id = cs.id
        JOIN teachers t ON t.id = ts.teacher_id
        WHERE t.profile_id = auth.uid()
      )
    );
  END IF;
END $$;
`

console.log('Copy and run this SQL in Supabase Dashboard > SQL Editor:\n')
console.log(sql)
console.log('\nOr if you have DB credentials, run with psql:')
console.log('psql "postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres" -c "' + sql.replace(/\n/g, ' ') + '"')
