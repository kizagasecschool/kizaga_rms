-- ============================================================
-- CLEAR ALL DATA FROM KIZAGA RMS
-- Keeps only: admin, amosi (amosshabani34), academic, headmaster
-- Run this in Supabase SQL Editor
-- ============================================================

BEGIN;

-- Profile IDs to PRESERVE
-- admin:       aeb0f0db-e505-46f9-89b5-fd44a29a5d28
-- amosi:       2937a889-d84e-44e3-a1ac-35f267b38aa4
-- academic:    05463236-cb9c-4d7e-acf6-6d7264638d14
-- headmaster:  de1d0dff-235a-48e8-9ea4-61c5a33807d5

-- Also preserve their teacher records if they exist
-- First find teacher IDs linked to preserved profiles
CREATE TEMP TABLE keep_ids AS
SELECT id FROM profiles WHERE id IN (
  'aeb0f0db-e505-46f9-89b5-fd44a29a5d28',
  '2937a889-d84e-44e3-a1ac-35f267b38aa4',
  '05463236-cb9c-4d7e-acf6-6d7264638d14',
  'de1d0dff-235a-48e8-9ea4-61c5a33807d5'
);

-- Delete data from child tables first (respecting FK constraints)
DELETE FROM marks;
DELETE FROM student_results;
DELETE FROM attendance;
DELETE FROM exam_classes;
DELETE FROM student_subjects;
DELETE FROM teacher_subjects WHERE teacher_id NOT IN (SELECT id FROM teachers WHERE profile_id IN (SELECT id FROM keep_ids));
DELETE FROM subject_assignments;
DELETE FROM class_combinations;
DELETE FROM class_curricula;
DELETE FROM combination_subjects;
DELETE FROM admission_applications;
DELETE FROM uniforms;
DELETE FROM notifications;
DELETE FROM password_reset_tokens;
DELETE FROM announcements;
DELETE FROM audit_logs;
DELETE FROM events_announcements;
DELETE FROM joining_instructions;
DELETE FROM school_settings;

-- Delete curricula, combinations, subjects
DELETE FROM curricula;
DELETE FROM combinations;
DELETE FROM subjects;

-- Delete students
DELETE FROM students;

-- Delete teachers NOT linked to preserved profiles
DELETE FROM teachers WHERE profile_id NOT IN (SELECT id FROM keep_ids);

-- Delete class_streams, classes, streams
DELETE FROM class_streams;
DELETE FROM classes;
DELETE FROM streams;

-- Delete terms, academic_years
DELETE FROM terms;
DELETE FROM academic_years;

-- Delete exams
DELETE FROM exams;

-- Delete grades
DELETE FROM grades;

-- Delete profiles NOT in the keep list (teacher/tester accounts)
DELETE FROM profiles WHERE id NOT IN (SELECT id FROM keep_ids);

-- Delete auth.users NOT linked to preserved profiles
-- Note: This requires the auth schema which is only accessible as superuser
-- We'll handle auth.users separately
DELETE FROM auth.users WHERE id NOT IN (SELECT id FROM keep_ids);

DROP TABLE keep_ids;

COMMIT;

-- Verify: should show only 4 profiles
SELECT 'profiles remaining:' AS info, COUNT(*) FROM profiles;
SELECT email, full_name, role FROM profiles ORDER BY role;
