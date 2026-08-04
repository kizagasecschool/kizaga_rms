-- ============================================================
-- FIX: Recreate curricula/combinations tables cleanly
-- Drops and recreates all 5 curriculum-related tables.
-- Safe: these are new tables with no critical production data.
-- Does NOT touch: subjects, classes, students, teachers, etc.
-- ============================================================

-- ============================================================
-- 1. DROP existing tables (order matters for FK constraints)
-- ============================================================
DROP TABLE IF EXISTS public.class_combinations   CASCADE;
DROP TABLE IF EXISTS public.combination_subjects CASCADE;
DROP TABLE IF EXISTS public.class_curricula      CASCADE;
DROP TABLE IF EXISTS public.combinations         CASCADE;
DROP TABLE IF EXISTS public.curricula            CASCADE;

-- ============================================================
-- 2. CURRICULA
-- ============================================================
CREATE TABLE public.curricula (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL UNIQUE,
  level      TEXT NOT NULL CHECK (level IN ('O_LEVEL', 'A_LEVEL')),
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_curricula_updated_at ON public.curricula;
CREATE TRIGGER trg_curricula_updated_at
  BEFORE UPDATE ON public.curricula
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 3. COMBINATIONS
-- ============================================================
CREATE TABLE public.combinations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  code          TEXT NOT NULL UNIQUE,
  curriculum_id UUID NOT NULL REFERENCES public.curricula(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_combinations_curriculum ON public.combinations(curriculum_id);

DROP TRIGGER IF EXISTS trg_combinations_updated_at ON public.combinations;
CREATE TRIGGER trg_combinations_updated_at
  BEFORE UPDATE ON public.combinations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 4. COMBINATION_SUBJECTS
-- ============================================================
CREATE TABLE public.combination_subjects (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  combination_id  UUID NOT NULL REFERENCES public.combinations(id) ON DELETE CASCADE,
  subject_id      UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_combination_subjects_combination ON public.combination_subjects(combination_id);
CREATE INDEX IF NOT EXISTS idx_combination_subjects_subject     ON public.combination_subjects(subject_id);

ALTER TABLE public.combination_subjects ADD CONSTRAINT uq_combination_subject UNIQUE (combination_id, subject_id);

DROP TRIGGER IF EXISTS trg_combination_subjects_updated_at ON public.combination_subjects;
CREATE TRIGGER trg_combination_subjects_updated_at
  BEFORE UPDATE ON public.combination_subjects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 5. CLASS_CURRICULA
-- ============================================================
CREATE TABLE public.class_curricula (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id      UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  curriculum_id UUID NOT NULL REFERENCES public.curricula(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_class_curricula_class ON public.class_curricula(class_id);
ALTER TABLE public.class_curricula ADD CONSTRAINT uq_class_curriculum UNIQUE (class_id);

-- ============================================================
-- 6. CLASS_COMBINATIONS
-- ============================================================
CREATE TABLE public.class_combinations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id        UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  combination_id  UUID NOT NULL REFERENCES public.combinations(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_class_combinations_class ON public.class_combinations(class_id);
ALTER TABLE public.class_combinations ADD CONSTRAINT uq_class_combination UNIQUE (class_id, combination_id);

-- ============================================================
-- 7. SEED DATA: CURRICULA
-- ============================================================
INSERT INTO public.curricula (name, level, is_active) VALUES
  ('Old Curriculum O-Level', 'O_LEVEL', TRUE),
  ('New Curriculum O-Level', 'O_LEVEL', TRUE),
  ('Old Curriculum A-Level', 'A_LEVEL', TRUE),
  ('New Curriculum A-Level', 'A_LEVEL', TRUE);

-- ============================================================
-- 8. SEED DATA: CLASS → CURRICULUM
-- Form 1 & 2 → New Curriculum O-Level
-- Form 3 & 4 → Old Curriculum O-Level
-- ============================================================
INSERT INTO public.class_curricula (class_id, curriculum_id)
SELECT c.id, cu.id
FROM public.classes c
CROSS JOIN public.curricula cu
WHERE (c.class_name, cu.name) IN (
  ('Form 1', 'New Curriculum O-Level'),
  ('Form 2', 'New Curriculum O-Level'),
  ('Form 3', 'Old Curriculum O-Level'),
  ('Form 4', 'Old Curriculum O-Level')
)
AND NOT EXISTS (
  SELECT 1 FROM public.class_curricula cc WHERE cc.class_id = c.id
);

-- ============================================================
-- 9. SEED DATA: ALL 14 A-LEVEL COMBINATIONS (from kizaga.txt)
-- (Old Curriculum A-Level only)
-- ============================================================
INSERT INTO public.combinations (name, code, curriculum_id)
SELECT v.name, v.code, c.id
FROM (VALUES
  ('Physics Chemistry Mathematics',        'PCM', 'Old Curriculum A-Level'),
  ('Physics Chemistry Biology',            'PCB', 'Old Curriculum A-Level'),
  ('Chemistry Biology Geography',          'CBG', 'Old Curriculum A-Level'),
  ('Physics Geography Mathematics',        'PGM', 'Old Curriculum A-Level'),
  ('Chemistry Biology Agriculture',        'CBA', 'Old Curriculum A-Level'),
  ('Economics Commerce Accountancy',       'ECA', 'Old Curriculum A-Level'),
  ('History Geography Economics',          'HGE', 'Old Curriculum A-Level'),
  ('Economics Geography Accountancy',      'EGA', 'Old Curriculum A-Level'),
  ('Economics Geography Mathematics',      'EGM', 'Old Curriculum A-Level'),
  ('History Kiswahili Literature',         'HKL', 'Old Curriculum A-Level'),
  ('History Geography Kiswahili',          'HGK', 'Old Curriculum A-Level'),
  ('History Geography Language',           'HGL', 'Old Curriculum A-Level'),
  ('Kiswahili Literature French',          'KLF', 'Old Curriculum A-Level'),
  ('History Kiswahili Economics',          'HKE', 'Old Curriculum A-Level')
) AS v(name, code, curriculum_name)
JOIN public.curricula c ON c.name = v.curriculum_name
WHERE NOT EXISTS (SELECT 1 FROM public.combinations);

-- ============================================================
-- 10. ENABLE RLS & POLICIES
-- ============================================================
ALTER TABLE IF EXISTS public.curricula            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.combinations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.combination_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.class_curricula      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.class_combinations   ENABLE ROW LEVEL SECURITY;

-- Create get_my_role() if it doesn't exist
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_curricula'             AND tablename = 'curricula'             AND schemaname = 'public') THEN CREATE POLICY "admin_all_curricula"             ON public.curricula             FOR ALL   USING (get_my_role() = 'admin'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'read_curricula'                  AND tablename = 'curricula'             AND schemaname = 'public') THEN CREATE POLICY "read_curricula"                  ON public.curricula             FOR SELECT USING (get_my_role() IN ('headmaster', 'academic', 'teacher')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academic_rw_curricula'           AND tablename = 'curricula'             AND schemaname = 'public') THEN CREATE POLICY "academic_rw_curricula"           ON public.curricula             FOR ALL   USING (get_my_role() = 'academic'); END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_combinations'          AND tablename = 'combinations'          AND schemaname = 'public') THEN CREATE POLICY "admin_all_combinations"          ON public.combinations          FOR ALL   USING (get_my_role() = 'admin'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'read_combinations'               AND tablename = 'combinations'          AND schemaname = 'public') THEN CREATE POLICY "read_combinations"               ON public.combinations          FOR SELECT USING (get_my_role() IN ('headmaster', 'academic', 'teacher')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academic_rw_combinations'        AND tablename = 'combinations'          AND schemaname = 'public') THEN CREATE POLICY "academic_rw_combinations"        ON public.combinations          FOR ALL   USING (get_my_role() = 'academic'); END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_combination_subjects'   AND tablename = 'combination_subjects'  AND schemaname = 'public') THEN CREATE POLICY "admin_all_combination_subjects"   ON public.combination_subjects  FOR ALL   USING (get_my_role() = 'admin'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'read_combination_subjects'        AND tablename = 'combination_subjects'  AND schemaname = 'public') THEN CREATE POLICY "read_combination_subjects"        ON public.combination_subjects  FOR SELECT USING (get_my_role() IN ('headmaster', 'academic', 'teacher')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academic_rw_combination_subjects' AND tablename = 'combination_subjects'  AND schemaname = 'public') THEN CREATE POLICY "academic_rw_combination_subjects" ON public.combination_subjects  FOR ALL   USING (get_my_role() = 'academic'); END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_class_curricula'        AND tablename = 'class_curricula'       AND schemaname = 'public') THEN CREATE POLICY "admin_all_class_curricula"        ON public.class_curricula       FOR ALL   USING (get_my_role() = 'admin'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'read_class_curricula'             AND tablename = 'class_curricula'       AND schemaname = 'public') THEN CREATE POLICY "read_class_curricula"             ON public.class_curricula       FOR SELECT USING (get_my_role() IN ('headmaster', 'academic', 'teacher')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academic_rw_class_curricula'      AND tablename = 'class_curricula'       AND schemaname = 'public') THEN CREATE POLICY "academic_rw_class_curricula"      ON public.class_curricula       FOR ALL   USING (get_my_role() = 'academic'); END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_class_combinations'      AND tablename = 'class_combinations'    AND schemaname = 'public') THEN CREATE POLICY "admin_all_class_combinations"      ON public.class_combinations    FOR ALL   USING (get_my_role() = 'admin'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'read_class_combinations'           AND tablename = 'class_combinations'    AND schemaname = 'public') THEN CREATE POLICY "read_class_combinations"           ON public.class_combinations    FOR SELECT USING (get_my_role() IN ('headmaster', 'academic', 'teacher')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academic_rw_class_combinations'    AND tablename = 'class_combinations'    AND schemaname = 'public') THEN CREATE POLICY "academic_rw_class_combinations"    ON public.class_combinations    FOR ALL   USING (get_my_role() = 'academic'); END IF;
END $$;
