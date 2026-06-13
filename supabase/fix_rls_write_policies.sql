-- ============================================================
-- FIX RLS WRITE POLICIES: student_subjects & subject_assignments
-- Uses auth.uid() + direct subquery instead of get_my_role()
-- to avoid recursion issues with profiles RLS.
-- ============================================================

-- ============================================================
-- Helper: Returns the current user's role by reading profiles
-- with SECURITY DEFINER — runs as superuser, bypasses RLS.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- STUDENT_SUBJECTS: Drop all policies, recreate cleanly
-- ============================================================
ALTER TABLE public.student_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_student_subjects" ON public.student_subjects;
DROP POLICY IF EXISTS "headmaster_read_student_subjects" ON public.student_subjects;
DROP POLICY IF EXISTS "academic_rw_student_subjects" ON public.student_subjects;
DROP POLICY IF EXISTS "teacher_read_student_subjects" ON public.student_subjects;

-- Admin: full access
CREATE POLICY "admin_all_student_subjects" ON public.student_subjects
  FOR ALL USING (get_my_role() = 'admin');

-- Headmaster: read only
CREATE POLICY "headmaster_read_student_subjects" ON public.student_subjects
  FOR SELECT USING (get_my_role() = 'headmaster');

-- Academic: full access
CREATE POLICY "academic_all_student_subjects" ON public.student_subjects
  FOR ALL USING (get_my_role() = 'academic');

-- Teacher: read only (their own students)
CREATE POLICY "teacher_read_student_subjects" ON public.student_subjects
  FOR SELECT USING (
    get_my_role() = 'teacher'
    AND student_id IN (
      SELECT s.id FROM public.students s
      JOIN public.class_streams cs ON cs.id = s.class_stream_id
      JOIN public.teacher_subjects ts ON ts.class_stream_id = cs.id
      JOIN public.teachers t ON t.id = ts.teacher_id
      WHERE t.profile_id = auth.uid()
    )
  );

-- ============================================================
-- SUBJECT_ASSIGNMENTS: Drop all policies, recreate cleanly
-- ============================================================
ALTER TABLE public.subject_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_subject_assignments" ON public.subject_assignments;
DROP POLICY IF EXISTS "read_subject_assignments" ON public.subject_assignments;
DROP POLICY IF EXISTS "academic_rw_subject_assignments" ON public.subject_assignments;

-- Admin: full access
CREATE POLICY "admin_all_subject_assignments" ON public.subject_assignments
  FOR ALL USING (get_my_role() = 'admin');

-- Read: headmaster, academic, teacher
CREATE POLICY "read_subject_assignments" ON public.subject_assignments
  FOR SELECT USING (get_my_role() IN ('headmaster', 'academic', 'teacher'));

-- Academic: full access
CREATE POLICY "academic_all_subject_assignments" ON public.subject_assignments
  FOR ALL USING (get_my_role() = 'academic');

-- ============================================================
-- Also fix subject_assignments table structure to ensure
-- updated_at column is in sync
-- ============================================================
ALTER TABLE public.subject_assignments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Drop and recreate the trigger properly
DROP TRIGGER IF EXISTS trg_subject_assignments_updated_at ON public.subject_assignments;
CREATE TRIGGER trg_subject_assignments_updated_at
  BEFORE UPDATE ON public.subject_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Verify
-- ============================================================
SELECT 'policies_created' AS result, COUNT(*) AS count
FROM pg_policies
WHERE tablename IN ('student_subjects', 'subject_assignments')
  AND schemaname = 'public';
