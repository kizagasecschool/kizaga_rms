-- ============================================================
-- CLASS EXCLUDED SUBJECTS — Funga somo kwa darasa fulani
-- ============================================================

-- 1. UNDA TABLE
CREATE TABLE IF NOT EXISTS class_excluded_subjects (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id   UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_id, subject_id)
);

-- 2. WEZESHA RLS
ALTER TABLE class_excluded_subjects ENABLE ROW LEVEL SECURITY;

-- 3. POLICIES
DROP POLICY IF EXISTS "admin_headmaster_academic_all_class_excluded" ON class_excluded_subjects;
CREATE POLICY "admin_headmaster_academic_all_class_excluded" ON class_excluded_subjects
  FOR ALL USING ((SELECT get_my_role()) IN ('admin', 'headmaster', 'academic'));

DROP POLICY IF EXISTS "read_class_excluded_subjects" ON class_excluded_subjects;
CREATE POLICY "read_class_excluded_subjects" ON class_excluded_subjects
  FOR SELECT USING ((SELECT get_my_role()) IN ('teacher'));
