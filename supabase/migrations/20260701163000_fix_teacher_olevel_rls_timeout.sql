-- 20260701160000_fix_teacher_olevel_rls_gaps.sql fixed the wrong-results bug but
-- introduced a correlated subquery inside an OR, which Postgres re-evaluates per
-- row of student_subjects/student_results/attendance and times out on real data
-- (57014: canceling statement due to statement timeout).
--
-- Rewritten to match the cheap pattern from fix_teacher_olevel_students_rls.sql:
-- two independent, non-correlated IN-subqueries OR'd together.

DROP POLICY IF EXISTS "teacher_read_student_subjects" ON public.student_subjects;
CREATE POLICY "teacher_read_student_subjects" ON public.student_subjects
  FOR SELECT USING (
    get_my_role() = 'teacher'
    AND student_id IN (
      SELECT s.id FROM public.students s
      WHERE s.class_stream_id IN (
        SELECT ts.class_stream_id FROM public.teacher_subjects ts
        JOIN public.teachers t ON t.id = ts.teacher_id
        WHERE t.profile_id = auth.uid()
      )
      OR s.class_id IN (
        SELECT cs.class_id FROM public.teacher_subjects ts
        JOIN public.teachers t ON t.id = ts.teacher_id
        JOIN public.class_streams cs ON cs.id = ts.class_stream_id
        WHERE t.profile_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "teacher_read_student_results" ON public.student_results;
CREATE POLICY "teacher_read_student_results" ON public.student_results
  FOR SELECT USING (
    get_my_role() = 'teacher'
    AND student_id IN (
      SELECT s.id FROM public.students s
      WHERE s.class_stream_id IN (
        SELECT ts.class_stream_id FROM public.teacher_subjects ts
        JOIN public.teachers t ON t.id = ts.teacher_id
        WHERE t.profile_id = auth.uid()
      )
      OR s.class_id IN (
        SELECT cs.class_id FROM public.teacher_subjects ts
        JOIN public.teachers t ON t.id = ts.teacher_id
        JOIN public.class_streams cs ON cs.id = ts.class_stream_id
        WHERE t.profile_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "teacher_manage_attendance" ON public.attendance;
CREATE POLICY "teacher_manage_attendance" ON public.attendance
  FOR ALL USING (
    get_my_role() = 'teacher'
    AND student_id IN (
      SELECT s.id FROM public.students s
      WHERE s.class_stream_id IN (
        SELECT ts.class_stream_id FROM public.teacher_subjects ts
        JOIN public.teachers t ON t.id = ts.teacher_id
        WHERE t.profile_id = auth.uid()
      )
      OR s.class_id IN (
        SELECT cs.class_id FROM public.teacher_subjects ts
        JOIN public.teachers t ON t.id = ts.teacher_id
        JOIN public.class_streams cs ON cs.id = ts.class_stream_id
        WHERE t.profile_id = auth.uid()
      )
    )
  );
