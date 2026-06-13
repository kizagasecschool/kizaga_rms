-- ============================================================
-- A-LEVEL STUDENT COMBINATION ASSIGNMENTS
-- Links each A-Level student to their specific combination
-- (PCM, PCB, HGL, ECA, etc.)
-- Idempotent: safe to run multiple times
-- Run AFTER: migration_tables.sql, fix_curriculum.sql
-- Does NOT touch O-Level subjects or assignments
-- ============================================================

-- ============================================================
-- 1. STUDENT_COMBINATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.student_combinations (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id     UUID NOT NULL REFERENCES public.students(id)     ON DELETE CASCADE,
  combination_id UUID NOT NULL REFERENCES public.combinations(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One combination per student (a student belongs to exactly one combination)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_student_combination'
  ) THEN
    ALTER TABLE public.student_combinations
      ADD CONSTRAINT uq_student_combination UNIQUE (student_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_student_combinations_student
  ON public.student_combinations(student_id);

CREATE INDEX IF NOT EXISTS idx_student_combinations_combination
  ON public.student_combinations(combination_id);

DROP TRIGGER IF EXISTS trg_student_combinations_updated_at ON public.student_combinations;
CREATE TRIGGER trg_student_combinations_updated_at
  BEFORE UPDATE ON public.student_combinations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 2. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.student_combinations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'admin_all_student_combinations'
      AND tablename = 'student_combinations'
      AND schemaname = 'public'
  ) THEN
    CREATE POLICY "admin_all_student_combinations"
      ON public.student_combinations FOR ALL
      USING (get_my_role() = 'admin');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'headmaster_read_student_combinations'
      AND tablename = 'student_combinations'
      AND schemaname = 'public'
  ) THEN
    CREATE POLICY "headmaster_read_student_combinations"
      ON public.student_combinations FOR SELECT
      USING (get_my_role() = 'headmaster');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'academic_rw_student_combinations'
      AND tablename = 'student_combinations'
      AND schemaname = 'public'
  ) THEN
    CREATE POLICY "academic_rw_student_combinations"
      ON public.student_combinations FOR ALL
      USING (get_my_role() = 'academic');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'teacher_read_student_combinations'
      AND tablename = 'student_combinations'
      AND schemaname = 'public'
  ) THEN
    CREATE POLICY "teacher_read_student_combinations"
      ON public.student_combinations FOR SELECT
      USING (get_my_role() = 'teacher');
  END IF;
END $$;

-- ============================================================
-- END
-- ============================================================
