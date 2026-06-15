-- ============================================================
-- KIZAGA RMS: Reset subjects for fresh re-entry
-- WARNING: This deletes all subjects and all records that depend
-- on subjects, including marks. Run only when you intentionally
-- want to rebuild subjects from scratch.
-- ============================================================

BEGIN;

-- Remove dependent records first to satisfy foreign keys.
DELETE FROM public.marks;
DELETE FROM public.teacher_subjects;
DELETE FROM public.student_subjects;
DELETE FROM public.subject_assignments;
DELETE FROM public.combination_subjects;

-- Clear all subjects. New O-Level subjects should use:
-- level = 'O_LEVEL', subject_type = 'COMPULSORY' or 'OPTIONAL', curriculum = NULL.
DELETE FROM public.subjects;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Optional: after re-entering subjects, run this backfill to give
-- every active O-Level student all compulsory O-Level subjects.
-- Optional subjects are intentionally not auto-assigned.
-- ============================================================

-- INSERT INTO public.student_subjects (student_id, subject_id)
-- SELECT st.id, sub.id
-- FROM public.students st
-- LEFT JOIN public.class_streams cs ON cs.id = st.class_stream_id
-- LEFT JOIN public.classes cls ON cls.id = COALESCE(st.class_id, cs.class_id)
-- JOIN public.subjects sub
--   ON sub.level = 'O_LEVEL'
--  AND sub.subject_type = 'COMPULSORY'
-- WHERE cls.level = 'O_LEVEL'
--   AND st.status = 'active'
-- ON CONFLICT (student_id, subject_id) DO NOTHING;
