-- Fix FK constraints so deleting an auth user cascades cleanly through all related tables.
-- profiles.id → auth.users: CASCADE (deleting auth user removes the profile)
-- teachers.profile_id → profiles: CASCADE (deleting profile removes the teacher row)
-- teacher_subjects.teacher_id → teachers: CASCADE (deleting teacher removes their subject assignments)
-- marks.entered_by → profiles: SET NULL (keep historical marks, just lose the attribution)
-- announcements.created_by → profiles: SET NULL (keep announcements, lose attribution)
-- audit_logs.user_id → profiles: SET NULL (already nullable, update FK action)

-- 1. profiles → auth.users
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey,
  ADD CONSTRAINT profiles_id_fkey
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. teachers → profiles
ALTER TABLE public.teachers
  DROP CONSTRAINT IF EXISTS teachers_profile_id_fkey,
  ADD CONSTRAINT teachers_profile_id_fkey
    FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 3. teacher_subjects → teachers
ALTER TABLE public.teacher_subjects
  DROP CONSTRAINT IF EXISTS teacher_subjects_teacher_id_fkey,
  ADD CONSTRAINT teacher_subjects_teacher_id_fkey
    FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE CASCADE;

-- 4. marks.entered_by → profiles (make nullable, SET NULL on delete)
ALTER TABLE public.marks
  ALTER COLUMN entered_by DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS marks_entered_by_fkey,
  ADD CONSTRAINT marks_entered_by_fkey
    FOREIGN KEY (entered_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 5. announcements.created_by → profiles (make nullable, SET NULL on delete)
ALTER TABLE public.announcements
  ALTER COLUMN created_by DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS announcements_created_by_fkey,
  ADD CONSTRAINT announcements_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 6. audit_logs.user_id → profiles (update FK action to SET NULL)
ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey,
  ADD CONSTRAINT audit_logs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
