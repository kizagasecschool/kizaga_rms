-- O-Level students have class_stream_id = NULL (they're tracked by class_id).
-- fix_teacher_olevel_students_rls.sql already patched the `students` table policy
-- to fall back to class_id, but student_subjects, student_results, and attendance
-- policies were never updated — they still join purely on class_stream_id, so
-- `cs.id = s.class_stream_id` never matches for O-Level students and teachers
-- get zero rows back (RLS silently hides everything instead of erroring).

DROP POLICY IF EXISTS "teacher_read_student_subjects" ON public.student_subjects;
CREATE POLICY "teacher_read_student_subjects" ON public.student_subjects
  FOR SELECT USING (
    get_my_role() = 'teacher'
    AND student_id IN (
      SELECT s.id FROM public.students s
      JOIN public.teacher_subjects ts ON (
        ts.class_stream_id = s.class_stream_id
        OR ts.class_stream_id IN (
          SELECT cs.id FROM public.class_streams cs WHERE cs.class_id = s.class_id
        )
      )
      JOIN public.teachers t ON t.id = ts.teacher_id
      WHERE t.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "teacher_read_student_results" ON public.student_results;
CREATE POLICY "teacher_read_student_results" ON public.student_results
  FOR SELECT USING (
    get_my_role() = 'teacher'
    AND student_id IN (
      SELECT s.id FROM public.students s
      JOIN public.teacher_subjects ts ON (
        ts.class_stream_id = s.class_stream_id
        OR ts.class_stream_id IN (
          SELECT cs.id FROM public.class_streams cs WHERE cs.class_id = s.class_id
        )
      )
      JOIN public.teachers t ON t.id = ts.teacher_id
      WHERE t.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "teacher_manage_attendance" ON public.attendance;
CREATE POLICY "teacher_manage_attendance" ON public.attendance
  FOR ALL USING (
    get_my_role() = 'teacher'
    AND student_id IN (
      SELECT s.id FROM public.students s
      JOIN public.teacher_subjects ts ON (
        ts.class_stream_id = s.class_stream_id
        OR ts.class_stream_id IN (
          SELECT cs.id FROM public.class_streams cs WHERE cs.class_id = s.class_id
        )
      )
      JOIN public.teachers t ON t.id = ts.teacher_id
      WHERE t.profile_id = auth.uid()
    )
  );
