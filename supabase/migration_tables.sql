-- ============================================================
-- TANZANIAN SCHOOL ACADEMIC MANAGEMENT SYSTEM
-- Supabase PostgreSQL Schema
-- Supports Form 1–Form 6 (O-Level & A-Level)
-- Idempotent: safe to run multiple times
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- HELPER FUNCTION: updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT,
  full_name  TEXT,
  role       TEXT NOT NULL DEFAULT 'teacher' CHECK (role IN ('admin', 'headmaster', 'academic', 'teacher')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ============================================================
-- 2. ACADEMIC YEARS
-- ============================================================
CREATE TABLE IF NOT EXISTS academic_years (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  year_name   TEXT NOT NULL UNIQUE,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS year_name   TEXT NOT NULL UNIQUE;
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS start_date  DATE NOT NULL;
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS end_date    DATE NOT NULL;
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS is_active   BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_academic_years_active ON academic_years(is_active);

DROP TRIGGER IF EXISTS trg_academic_years_updated_at ON academic_years;
CREATE TRIGGER trg_academic_years_updated_at
  BEFORE UPDATE ON academic_years
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Only one active academic year at a time
CREATE OR REPLACE FUNCTION enforce_single_active_academic_year()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = TRUE THEN
    UPDATE academic_years SET is_active = FALSE
    WHERE id <> NEW.id AND is_active = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_single_active_academic_year ON academic_years;
CREATE TRIGGER trg_single_active_academic_year
  BEFORE INSERT OR UPDATE ON academic_years
  FOR EACH ROW EXECUTE FUNCTION enforce_single_active_academic_year();

-- ============================================================
-- 3. TERMS
-- ============================================================
CREATE TABLE IF NOT EXISTS terms (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  term_name        TEXT NOT NULL,
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE terms ADD COLUMN IF NOT EXISTS academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE;
ALTER TABLE terms ADD COLUMN IF NOT EXISTS term_name        TEXT NOT NULL;
ALTER TABLE terms ADD COLUMN IF NOT EXISTS start_date       DATE NOT NULL;
ALTER TABLE terms ADD COLUMN IF NOT EXISTS end_date         DATE NOT NULL;
ALTER TABLE terms ADD COLUMN IF NOT EXISTS is_active        BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE terms ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE terms ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_terms_academic_year ON terms(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_terms_active        ON terms(is_active);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_term_dates') THEN
    ALTER TABLE terms ADD CONSTRAINT chk_term_dates CHECK (end_date > start_date);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_term_per_year') THEN
    ALTER TABLE terms ADD CONSTRAINT uq_term_per_year UNIQUE (academic_year_id, term_name);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_terms_updated_at ON terms;
CREATE TRIGGER trg_terms_updated_at
  BEFORE UPDATE ON terms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 4. CLASSES
-- ============================================================
CREATE TABLE IF NOT EXISTS classes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_name  TEXT NOT NULL UNIQUE,
  level       TEXT NOT NULL CHECK (level IN ('O_LEVEL', 'A_LEVEL')),
  sort_order  INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE classes ADD COLUMN IF NOT EXISTS class_name TEXT NOT NULL UNIQUE;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS level      TEXT NOT NULL CHECK (level IN ('O_LEVEL', 'A_LEVEL'));
ALTER TABLE classes ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE classes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS trg_classes_updated_at ON classes;
CREATE TRIGGER trg_classes_updated_at
  BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 5. STREAMS
-- ============================================================
CREATE TABLE IF NOT EXISTS streams (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stream_name TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE streams ADD COLUMN IF NOT EXISTS stream_name TEXT NOT NULL UNIQUE;
ALTER TABLE streams ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE streams ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS trg_streams_updated_at ON streams;
CREATE TRIGGER trg_streams_updated_at
  BEFORE UPDATE ON streams
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 6. CLASS_STREAMS
-- ============================================================
CREATE TABLE IF NOT EXISTS class_streams (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id   UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  stream_id  UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE class_streams ADD COLUMN IF NOT EXISTS class_id   UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE class_streams ADD COLUMN IF NOT EXISTS stream_id  UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE;
ALTER TABLE class_streams ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE class_streams ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_class_streams_class  ON class_streams(class_id);
CREATE INDEX IF NOT EXISTS idx_class_streams_stream ON class_streams(stream_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_class_stream') THEN
    ALTER TABLE class_streams ADD CONSTRAINT uq_class_stream UNIQUE (class_id, stream_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_class_streams_updated_at ON class_streams;
CREATE TRIGGER trg_class_streams_updated_at
  BEFORE UPDATE ON class_streams
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 7. STUDENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS students (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admission_number TEXT NOT NULL UNIQUE,
  first_name       TEXT NOT NULL,
  middle_name      TEXT,
  surname          TEXT NOT NULL,
  gender           TEXT NOT NULL CHECK (gender IN ('Male', 'Female')),
  date_of_birth    DATE NOT NULL,
  class_stream_id  UUID REFERENCES class_streams(id) ON DELETE SET NULL,
  admission_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated', 'transferred', 'expelled')),
  parent_name      TEXT,
  parent_phone     TEXT,
  address          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE students ADD COLUMN IF NOT EXISTS admission_number TEXT NOT NULL UNIQUE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS first_name       TEXT NOT NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS middle_name      TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS surname          TEXT NOT NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS gender           TEXT NOT NULL CHECK (gender IN ('Male', 'Female'));
ALTER TABLE students ADD COLUMN IF NOT EXISTS date_of_birth    DATE NOT NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS class_stream_id  UUID REFERENCES class_streams(id) ON DELETE SET NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS admission_date   DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated', 'transferred', 'expelled'));
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_name      TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_phone     TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS address          TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE students ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_students_admission_number ON students(admission_number);
CREATE INDEX IF NOT EXISTS idx_students_class_stream     ON students(class_stream_id);
CREATE INDEX IF NOT EXISTS idx_students_status           ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_name             ON students(surname, first_name);

DROP TRIGGER IF EXISTS trg_students_updated_at ON students;
CREATE TRIGGER trg_students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 8. TEACHERS
-- ============================================================
CREATE TABLE IF NOT EXISTS teachers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_number TEXT NOT NULL UNIQUE,
  profile_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  qualification   TEXT,
  phone           TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE teachers ADD COLUMN IF NOT EXISTS employee_number TEXT NOT NULL UNIQUE;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS profile_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS qualification   TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS phone           TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave'));
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_teachers_profile           ON teachers(profile_id);
CREATE INDEX IF NOT EXISTS idx_teachers_status            ON teachers(status);
CREATE INDEX IF NOT EXISTS idx_teachers_employee_number   ON teachers(employee_number);

DROP TRIGGER IF EXISTS trg_teachers_updated_at ON teachers;
CREATE TRIGGER trg_teachers_updated_at
  BEFORE UPDATE ON teachers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 9. SUBJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS subjects (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_code TEXT NOT NULL UNIQUE,
  subject_name TEXT NOT NULL,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('COMPULSORY', 'OPTIONAL', 'ELECTIVE')),
  level        TEXT NOT NULL CHECK (level IN ('O_LEVEL', 'A_LEVEL')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE subjects ADD COLUMN IF NOT EXISTS subject_code TEXT NOT NULL UNIQUE;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS subject_name TEXT NOT NULL;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS subject_type TEXT NOT NULL CHECK (subject_type IN ('COMPULSORY', 'OPTIONAL', 'ELECTIVE'));
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS level        TEXT NOT NULL CHECK (level IN ('O_LEVEL', 'A_LEVEL'));
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_subjects_level ON subjects(level);
CREATE INDEX IF NOT EXISTS idx_subjects_code  ON subjects(subject_code);

DROP TRIGGER IF EXISTS trg_subjects_updated_at ON subjects;
CREATE TRIGGER trg_subjects_updated_at
  BEFORE UPDATE ON subjects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 10. TEACHER_SUBJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS teacher_subjects (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id      UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  class_stream_id UUID NOT NULL REFERENCES class_streams(id) ON DELETE CASCADE,
  subject_id      UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE teacher_subjects ADD COLUMN IF NOT EXISTS teacher_id      UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE;
ALTER TABLE teacher_subjects ADD COLUMN IF NOT EXISTS class_stream_id UUID NOT NULL REFERENCES class_streams(id) ON DELETE CASCADE;
ALTER TABLE teacher_subjects ADD COLUMN IF NOT EXISTS subject_id      UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE teacher_subjects ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE teacher_subjects ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_teacher_subjects_teacher      ON teacher_subjects(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_subjects_class_stream ON teacher_subjects(class_stream_id);
CREATE INDEX IF NOT EXISTS idx_teacher_subjects_subject      ON teacher_subjects(subject_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_teacher_subject_stream') THEN
    ALTER TABLE teacher_subjects ADD CONSTRAINT uq_teacher_subject_stream UNIQUE (teacher_id, class_stream_id, subject_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_teacher_subjects_updated_at ON teacher_subjects;
CREATE TRIGGER trg_teacher_subjects_updated_at
  BEFORE UPDATE ON teacher_subjects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 11. SUBJECT_ASSIGNMENTS (assigned at CLASS level, not stream)
-- ============================================================
CREATE TABLE IF NOT EXISTS subject_assignments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  class_id   UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE subject_assignments ADD COLUMN IF NOT EXISTS subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE subject_assignments ADD COLUMN IF NOT EXISTS class_id   UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE subject_assignments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE subject_assignments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Migrate from old class_stream_id to class_id if needed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subject_assignments' AND column_name = 'class_stream_id') THEN
    UPDATE subject_assignments sa
    SET class_id = cs.class_id
    FROM class_streams cs
    WHERE sa.class_stream_id = cs.id
      AND sa.class_id IS NULL;
    ALTER TABLE subject_assignments DROP CONSTRAINT IF EXISTS subject_assignments_class_stream_id_fkey;
    ALTER TABLE subject_assignments DROP COLUMN IF EXISTS class_stream_id;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_subject_assignments_class_stream;
CREATE INDEX IF NOT EXISTS idx_subject_assignments_class ON subject_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_subject_assignments_subject ON subject_assignments(subject_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_subject_assignment') THEN
    ALTER TABLE subject_assignments ADD CONSTRAINT uq_subject_assignment UNIQUE (subject_id, class_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_subject_assignments_updated_at ON subject_assignments;
CREATE TRIGGER trg_subject_assignments_updated_at
  BEFORE UPDATE ON subject_assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 12. STUDENT_SUBJECTS
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

-- ============================================================
-- 13. EXAMS
-- ============================================================
CREATE TABLE IF NOT EXISTS exams (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_name        TEXT NOT NULL,
  term_id          UUID NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  exam_type        TEXT NOT NULL CHECK (exam_type IN ('MONTHLY', 'MIDTERM', 'TERMINAL', 'MOCK', 'ANNUAL')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE exams ADD COLUMN IF NOT EXISTS exam_name        TEXT NOT NULL;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS term_id          UUID NOT NULL REFERENCES terms(id) ON DELETE CASCADE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS exam_type        TEXT NOT NULL CHECK (exam_type IN ('MONTHLY', 'MIDTERM', 'TERMINAL', 'MOCK', 'ANNUAL'));
ALTER TABLE exams ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE exams ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_exams_term          ON exams(term_id);
CREATE INDEX IF NOT EXISTS idx_exams_academic_year ON exams(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_exams_type          ON exams(exam_type);

DROP TRIGGER IF EXISTS trg_exams_updated_at ON exams;
CREATE TRIGGER trg_exams_updated_at
  BEFORE UPDATE ON exams
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 14. MARKS
-- ============================================================
CREATE TABLE IF NOT EXISTS marks (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id     UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id     UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  exam_id        UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  marks_obtained NUMERIC(5,2) NOT NULL CHECK (marks_obtained >= 0 AND marks_obtained <= 100),
  entered_by     UUID NOT NULL REFERENCES profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE marks ADD COLUMN IF NOT EXISTS student_id     UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE marks ADD COLUMN IF NOT EXISTS subject_id     UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE marks ADD COLUMN IF NOT EXISTS exam_id        UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE;
ALTER TABLE marks ADD COLUMN IF NOT EXISTS marks_obtained NUMERIC(5,2) NOT NULL CHECK (marks_obtained >= 0 AND marks_obtained <= 100);
ALTER TABLE marks ADD COLUMN IF NOT EXISTS entered_by     UUID NOT NULL REFERENCES profiles(id);
ALTER TABLE marks ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE marks ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_marks_student ON marks(student_id);
CREATE INDEX IF NOT EXISTS idx_marks_exam    ON marks(exam_id);
CREATE INDEX IF NOT EXISTS idx_marks_subject ON marks(subject_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_mark_per_student_subject_exam') THEN
    ALTER TABLE marks ADD CONSTRAINT uq_mark_per_student_subject_exam UNIQUE (student_id, subject_id, exam_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_marks_updated_at ON marks;
CREATE TRIGGER trg_marks_updated_at
  BEFORE UPDATE ON marks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 15. GRADES
-- ============================================================
CREATE TABLE IF NOT EXISTS grades (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  min_mark  NUMERIC(5,2) NOT NULL,
  max_mark  NUMERIC(5,2) NOT NULL,
  grade     TEXT NOT NULL,
  points    INTEGER NOT NULL,
  remarks   TEXT NOT NULL,
  level     TEXT NOT NULL CHECK (level IN ('O_LEVEL', 'A_LEVEL')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE grades ADD COLUMN IF NOT EXISTS min_mark   NUMERIC(5,2) NOT NULL;
ALTER TABLE grades ADD COLUMN IF NOT EXISTS max_mark   NUMERIC(5,2) NOT NULL;
ALTER TABLE grades ADD COLUMN IF NOT EXISTS grade      TEXT NOT NULL;
ALTER TABLE grades ADD COLUMN IF NOT EXISTS points     INTEGER NOT NULL;
ALTER TABLE grades ADD COLUMN IF NOT EXISTS remarks    TEXT NOT NULL;
ALTER TABLE grades ADD COLUMN IF NOT EXISTS level      TEXT NOT NULL CHECK (level IN ('O_LEVEL', 'A_LEVEL'));
ALTER TABLE grades ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE grades ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_grades_level ON grades(level);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_grade_range') THEN
    ALTER TABLE grades ADD CONSTRAINT chk_grade_range CHECK (max_mark >= min_mark);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_grade_per_level') THEN
    ALTER TABLE grades ADD CONSTRAINT uq_grade_per_level UNIQUE (grade, level);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_grades_updated_at ON grades;
CREATE TRIGGER trg_grades_updated_at
  BEFORE UPDATE ON grades
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 16. STUDENT_RESULTS
-- ============================================================
CREATE TABLE IF NOT EXISTS student_results (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  exam_id       UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  total_marks   NUMERIC(8,2) NOT NULL DEFAULT 0,
  average_marks NUMERIC(5,2) NOT NULL DEFAULT 0,
  grade         TEXT,
  division      TEXT,
  position      INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE student_results ADD COLUMN IF NOT EXISTS student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE student_results ADD COLUMN IF NOT EXISTS exam_id       UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE;
ALTER TABLE student_results ADD COLUMN IF NOT EXISTS total_marks   NUMERIC(8,2) NOT NULL DEFAULT 0;
ALTER TABLE student_results ADD COLUMN IF NOT EXISTS average_marks NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE student_results ADD COLUMN IF NOT EXISTS grade         TEXT;
ALTER TABLE student_results ADD COLUMN IF NOT EXISTS division      TEXT;
ALTER TABLE student_results ADD COLUMN IF NOT EXISTS position      INTEGER;
ALTER TABLE student_results ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE student_results ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_student_results_student ON student_results(student_id);
CREATE INDEX IF NOT EXISTS idx_student_results_exam    ON student_results(exam_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_student_result') THEN
    ALTER TABLE student_results ADD CONSTRAINT uq_student_result UNIQUE (student_id, exam_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_student_results_updated_at ON student_results;
CREATE TRIGGER trg_student_results_updated_at
  BEFORE UPDATE ON student_results
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 17. ATTENDANCE
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS date       DATE NOT NULL;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS status     TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused'));
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS notes      TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date    ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_status  ON attendance(status);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_attendance_per_day') THEN
    ALTER TABLE attendance ADD CONSTRAINT uq_attendance_per_day UNIQUE (student_id, date);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_attendance_updated_at ON attendance;
CREATE TRIGGER trg_attendance_updated_at
  BEFORE UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 18. ANNOUNCEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS announcements (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE announcements ADD COLUMN IF NOT EXISTS title      TEXT NOT NULL;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS content    TEXT NOT NULL;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS created_by UUID NOT NULL REFERENCES profiles(id);
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_announcements_created_by ON announcements(created_by);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);

DROP TRIGGER IF EXISTS trg_announcements_updated_at ON announcements;
CREATE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 19. AUDIT_LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id  UUID,
  old_data   JSONB,
  new_data   JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_id    UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action     TEXT NOT NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS table_name TEXT NOT NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS record_id  UUID;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_data   JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_data   JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_audit_logs_user       ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table      ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record     ON audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================================
-- 20. SCHOOL_SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS school_settings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_name TEXT NOT NULL,
  school_code TEXT NOT NULL UNIQUE,
  address     TEXT,
  phone       TEXT,
  email       TEXT,
  logo_url    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS school_name TEXT NOT NULL;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS school_code TEXT NOT NULL UNIQUE;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS address     TEXT;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS phone       TEXT;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS email       TEXT;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS logo_url    TEXT;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS trg_school_settings_updated_at ON school_settings;
CREATE TRIGGER trg_school_settings_updated_at
  BEFORE UPDATE ON school_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- HELPER FUNCTION: Get grade for a mark
-- ============================================================
CREATE OR REPLACE FUNCTION get_grade_for_mark(p_marks NUMERIC, p_level TEXT)
RETURNS TABLE(grade TEXT, points INTEGER, remarks TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT g.grade, g.points, g.remarks
  FROM grades g
  WHERE g.level = p_level
    AND p_marks >= g.min_mark
    AND p_marks <= g.max_mark
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- HELPER FUNCTION: Calculate O-Level Division
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_o_level_division(p_total_points INTEGER)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE
    WHEN p_total_points BETWEEN 7  AND 17 THEN 'Division I'
    WHEN p_total_points BETWEEN 18 AND 21 THEN 'Division II'
    WHEN p_total_points BETWEEN 22 AND 25 THEN 'Division III'
    WHEN p_total_points BETWEEN 26 AND 33 THEN 'Division IV'
    ELSE 'Division 0'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- HELPER FUNCTION: Calculate A-Level GPA
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_a_level_gpa(p_total_points INTEGER, p_subject_count INTEGER)
RETURNS TEXT AS $$
DECLARE
  v_gpa NUMERIC;
BEGIN
  IF p_subject_count = 0 THEN RETURN 'N/A'; END IF;
  v_gpa := p_total_points::NUMERIC / p_subject_count;
  RETURN CASE
    WHEN v_gpa >= 4.6 THEN 'GPA A'
    WHEN v_gpa >= 3.5 THEN 'GPA B'
    WHEN v_gpa >= 2.5 THEN 'GPA C'
    WHEN v_gpa >= 1.5 THEN 'GPA D'
    WHEN v_gpa >= 0.5 THEN 'GPA E'
    ELSE 'GPA F'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- HELPER FUNCTION: Compute and update student results
-- ============================================================
CREATE OR REPLACE FUNCTION compute_student_result(p_student_id UUID, p_exam_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total       NUMERIC := 0;
  v_count       INTEGER := 0;
  v_average     NUMERIC := 0;
  v_grade       TEXT;
  v_division    TEXT;
  v_level       TEXT;
  v_points_sum  INTEGER := 0;
  v_points      INTEGER;
  rec           RECORD;
BEGIN
  SELECT c.level INTO v_level
  FROM students s
  JOIN class_streams cs ON cs.id = s.class_stream_id
  JOIN classes c ON c.id = cs.class_id
  WHERE s.id = p_student_id;

  FOR rec IN
    SELECT m.marks_obtained, sub.level AS sub_level
    FROM marks m
    JOIN subjects sub ON sub.id = m.subject_id
    WHERE m.student_id = p_student_id AND m.exam_id = p_exam_id
  LOOP
    v_total := v_total + rec.marks_obtained;
    v_count := v_count + 1;
    SELECT g.points INTO v_points
    FROM grades g
    WHERE g.level = COALESCE(v_level, rec.sub_level)
      AND rec.marks_obtained >= g.min_mark
      AND rec.marks_obtained <= g.max_mark
    LIMIT 1;
    v_points_sum := v_points_sum + COALESCE(v_points, 0);
  END LOOP;

  IF v_count > 0 THEN
    v_average := v_total / v_count;
  END IF;

  SELECT g.grade INTO v_grade
  FROM grades g
  WHERE g.level = COALESCE(v_level, 'O_LEVEL')
    AND v_average >= g.min_mark
    AND v_average <= g.max_mark
  LIMIT 1;

  IF COALESCE(v_level, 'O_LEVEL') = 'O_LEVEL' THEN
    v_division := calculate_o_level_division(v_points_sum);
  ELSE
    v_division := calculate_a_level_gpa(v_points_sum, v_count);
  END IF;

  INSERT INTO student_results (student_id, exam_id, total_marks, average_marks, grade, division)
  VALUES (p_student_id, p_exam_id, v_total, v_average, v_grade, v_division)
  ON CONFLICT (student_id, exam_id)
  DO UPDATE SET
    total_marks   = EXCLUDED.total_marks,
    average_marks = EXCLUDED.average_marks,
    grade         = EXCLUDED.grade,
    division      = EXCLUDED.division,
    updated_at    = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGER: Auto-compute results when marks are inserted/updated
-- ============================================================
CREATE OR REPLACE FUNCTION trg_auto_compute_result()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM compute_student_result(NEW.student_id, NEW.exam_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_marks_auto_result ON marks;
CREATE TRIGGER trg_marks_auto_result
  AFTER INSERT OR UPDATE ON marks
  FOR EACH ROW EXECUTE FUNCTION trg_auto_compute_result();

-- ============================================================
-- FUNCTION: Update class rankings after results are computed
-- ============================================================
CREATE OR REPLACE FUNCTION update_class_rankings(p_exam_id UUID)
RETURNS VOID AS $$
BEGIN
  WITH ranked AS (
    SELECT
      sr.id,
      RANK() OVER (
        PARTITION BY s.class_stream_id
        ORDER BY sr.average_marks DESC
      ) AS pos
    FROM student_results sr
    JOIN students s ON s.id = sr.student_id
    WHERE sr.exam_id = p_exam_id
  )
  UPDATE student_results sr
  SET position = ranked.pos
  FROM ranked
  WHERE sr.id = ranked.id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- AUDIT LOG HELPER
-- ============================================================
CREATE OR REPLACE FUNCTION log_audit(
  p_user_id    UUID,
  p_action     TEXT,
  p_table_name TEXT,
  p_record_id  UUID,
  p_old_data   JSONB DEFAULT NULL,
  p_new_data   JSONB DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data)
  VALUES (p_user_id, p_action, p_table_name, p_record_id, p_old_data, p_new_data);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 21. CURRICULA
-- ============================================================
CREATE TABLE IF NOT EXISTS curricula (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL UNIQUE,
  level      TEXT NOT NULL CHECK (level IN ('O_LEVEL', 'A_LEVEL')),
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE curricula ADD COLUMN IF NOT EXISTS name      TEXT NOT NULL UNIQUE;
ALTER TABLE curricula ADD COLUMN IF NOT EXISTS level     TEXT NOT NULL CHECK (level IN ('O_LEVEL', 'A_LEVEL'));
ALTER TABLE curricula ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE curricula ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE curricula ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS trg_curricula_updated_at ON curricula;
CREATE TRIGGER trg_curricula_updated_at
  BEFORE UPDATE ON curricula
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 22. COMBINATIONS (A-Level subject groups like PCM, PCB, HGL)
-- ============================================================
CREATE TABLE IF NOT EXISTS combinations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  code          TEXT NOT NULL UNIQUE,
  curriculum_id UUID NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE combinations ADD COLUMN IF NOT EXISTS name          TEXT NOT NULL;
ALTER TABLE combinations ADD COLUMN IF NOT EXISTS code          TEXT NOT NULL UNIQUE;
ALTER TABLE combinations ADD COLUMN IF NOT EXISTS curriculum_id UUID NOT NULL REFERENCES curricula(id) ON DELETE CASCADE;
ALTER TABLE combinations ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE combinations ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_combinations_curriculum ON combinations(curriculum_id);

DROP TRIGGER IF EXISTS trg_combinations_updated_at ON combinations;
CREATE TRIGGER trg_combinations_updated_at
  BEFORE UPDATE ON combinations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 23. COMBINATION_SUBJECTS (subjects within a combination)
-- ============================================================
CREATE TABLE IF NOT EXISTS combination_subjects (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  combination_id  UUID NOT NULL REFERENCES combinations(id) ON DELETE CASCADE,
  subject_id      UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE combination_subjects ADD COLUMN IF NOT EXISTS combination_id UUID NOT NULL REFERENCES combinations(id) ON DELETE CASCADE;
ALTER TABLE combination_subjects ADD COLUMN IF NOT EXISTS subject_id     UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE combination_subjects ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE combination_subjects ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_combination_subjects_combination ON combination_subjects(combination_id);
CREATE INDEX IF NOT EXISTS idx_combination_subjects_subject     ON combination_subjects(subject_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_combination_subject') THEN
    ALTER TABLE combination_subjects ADD CONSTRAINT uq_combination_subject UNIQUE (combination_id, subject_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_combination_subjects_updated_at ON combination_subjects;
CREATE TRIGGER trg_combination_subjects_updated_at
  BEFORE UPDATE ON combination_subjects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 24. CLASS_CURRICULUM (which curriculum a class uses)
-- ============================================================
CREATE TABLE IF NOT EXISTS class_curricula (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id      UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  curriculum_id UUID NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE class_curricula ADD COLUMN IF NOT EXISTS class_id      UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE class_curricula ADD COLUMN IF NOT EXISTS curriculum_id UUID NOT NULL REFERENCES curricula(id) ON DELETE CASCADE;
ALTER TABLE class_curricula ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_class_curricula_class ON class_curricula(class_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_class_curriculum') THEN
    ALTER TABLE class_curricula ADD CONSTRAINT uq_class_curriculum UNIQUE (class_id);
  END IF;
END $$;

-- ============================================================
-- 25. CLASS_COMBINATIONS (A-Level: which combos a class offers)
-- ============================================================
CREATE TABLE IF NOT EXISTS class_combinations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id        UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  combination_id  UUID NOT NULL REFERENCES combinations(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE class_combinations ADD COLUMN IF NOT EXISTS class_id       UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE class_combinations ADD COLUMN IF NOT EXISTS combination_id UUID NOT NULL REFERENCES combinations(id) ON DELETE CASCADE;
ALTER TABLE class_combinations ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_class_combinations_class ON class_combinations(class_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_class_combination') THEN
    ALTER TABLE class_combinations ADD CONSTRAINT uq_class_combination UNIQUE (class_id, combination_id);
  END IF;
END $$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles'           AND schemaname = 'public') THEN ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'academic_years'     AND schemaname = 'public') THEN ALTER TABLE academic_years     ENABLE ROW LEVEL SECURITY; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'terms'              AND schemaname = 'public') THEN ALTER TABLE terms              ENABLE ROW LEVEL SECURITY; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'classes'            AND schemaname = 'public') THEN ALTER TABLE classes            ENABLE ROW LEVEL SECURITY; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'streams'            AND schemaname = 'public') THEN ALTER TABLE streams            ENABLE ROW LEVEL SECURITY; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'class_streams'      AND schemaname = 'public') THEN ALTER TABLE class_streams      ENABLE ROW LEVEL SECURITY; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'students'           AND schemaname = 'public') THEN ALTER TABLE students           ENABLE ROW LEVEL SECURITY; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'teachers'           AND schemaname = 'public') THEN ALTER TABLE teachers           ENABLE ROW LEVEL SECURITY; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subjects'           AND schemaname = 'public') THEN ALTER TABLE subjects           ENABLE ROW LEVEL SECURITY; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'teacher_subjects'   AND schemaname = 'public') THEN ALTER TABLE teacher_subjects   ENABLE ROW LEVEL SECURITY; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subject_assignments' AND schemaname = 'public') THEN ALTER TABLE subject_assignments ENABLE ROW LEVEL SECURITY; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_subjects'    AND schemaname = 'public') THEN ALTER TABLE student_subjects    ENABLE ROW LEVEL SECURITY; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'curricula'           AND schemaname = 'public') THEN ALTER TABLE curricula           ENABLE ROW LEVEL SECURITY; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'combinations'        AND schemaname = 'public') THEN ALTER TABLE combinations        ENABLE ROW LEVEL SECURITY; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'combination_subjects' AND schemaname = 'public') THEN ALTER TABLE combination_subjects ENABLE ROW LEVEL SECURITY; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'class_curricula'      AND schemaname = 'public') THEN ALTER TABLE class_curricula      ENABLE ROW LEVEL SECURITY; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'class_combinations'   AND schemaname = 'public') THEN ALTER TABLE class_combinations   ENABLE ROW LEVEL SECURITY; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'exams'              AND schemaname = 'public') THEN ALTER TABLE exams              ENABLE ROW LEVEL SECURITY; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'marks'              AND schemaname = 'public') THEN ALTER TABLE marks              ENABLE ROW LEVEL SECURITY; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'grades'             AND schemaname = 'public') THEN ALTER TABLE grades             ENABLE ROW LEVEL SECURITY; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_results'    AND schemaname = 'public') THEN ALTER TABLE student_results    ENABLE ROW LEVEL SECURITY; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attendance'         AND schemaname = 'public') THEN ALTER TABLE attendance         ENABLE ROW LEVEL SECURITY; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'announcements'      AND schemaname = 'public') THEN ALTER TABLE announcements      ENABLE ROW LEVEL SECURITY; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs'         AND schemaname = 'public') THEN ALTER TABLE audit_logs         ENABLE ROW LEVEL SECURITY; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'school_settings'    AND schemaname = 'public') THEN ALTER TABLE school_settings    ENABLE ROW LEVEL SECURITY; END IF;
END $$;

-- ============================================================
-- HELPER: Get current user role
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================================
-- RLS POLICIES: PROFILES
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_profiles'           AND tablename = 'profiles') THEN CREATE POLICY "admin_all_profiles" ON profiles FOR ALL USING (get_my_role() = 'admin'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'headmaster_read_profiles'     AND tablename = 'profiles') THEN CREATE POLICY "headmaster_read_profiles" ON profiles FOR SELECT USING (get_my_role() = 'headmaster'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academic_read_profiles'       AND tablename = 'profiles') THEN CREATE POLICY "academic_read_profiles" ON profiles FOR SELECT USING (get_my_role() = 'academic'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academic_write_profiles'      AND tablename = 'profiles') THEN CREATE POLICY "academic_write_profiles" ON profiles FOR INSERT WITH CHECK (get_my_role() = 'academic'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academic_update_profiles'     AND tablename = 'profiles') THEN CREATE POLICY "academic_update_profiles" ON profiles FOR UPDATE USING (get_my_role() = 'academic'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'teacher_own_profile'          AND tablename = 'profiles') THEN CREATE POLICY "teacher_own_profile" ON profiles FOR SELECT USING (id = auth.uid() AND get_my_role() = 'teacher'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'teacher_update_own_profile'   AND tablename = 'profiles') THEN CREATE POLICY "teacher_update_own_profile" ON profiles FOR UPDATE USING (id = auth.uid() AND get_my_role() = 'teacher'); END IF;
END $$;

-- ============================================================
-- RLS POLICIES: ACADEMIC YEARS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_academic_years'      AND tablename = 'academic_years') THEN CREATE POLICY "admin_all_academic_years" ON academic_years FOR ALL USING (get_my_role() = 'admin'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'headmaster_read_academic_years' AND tablename = 'academic_years') THEN CREATE POLICY "headmaster_read_academic_years" ON academic_years FOR SELECT USING (get_my_role() = 'headmaster'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academic_rw_academic_years'    AND tablename = 'academic_years') THEN CREATE POLICY "academic_rw_academic_years" ON academic_years FOR ALL USING (get_my_role() = 'academic'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'teacher_read_academic_years'   AND tablename = 'academic_years') THEN CREATE POLICY "teacher_read_academic_years" ON academic_years FOR SELECT USING (get_my_role() = 'teacher'); END IF;
END $$;

-- ============================================================
-- RLS POLICIES: TERMS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_terms'      AND tablename = 'terms') THEN CREATE POLICY "admin_all_terms" ON terms FOR ALL USING (get_my_role() = 'admin'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'headmaster_read_terms' AND tablename = 'terms') THEN CREATE POLICY "headmaster_read_terms" ON terms FOR SELECT USING (get_my_role() = 'headmaster'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academic_rw_terms'    AND tablename = 'terms') THEN CREATE POLICY "academic_rw_terms" ON terms FOR ALL USING (get_my_role() = 'academic'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'teacher_read_terms'   AND tablename = 'terms') THEN CREATE POLICY "teacher_read_terms" ON terms FOR SELECT USING (get_my_role() = 'teacher'); END IF;
END $$;

-- ============================================================
-- RLS POLICIES: CLASSES & STREAMS & CLASS_STREAMS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_classes'     AND tablename = 'classes') THEN CREATE POLICY "admin_all_classes" ON classes FOR ALL USING (get_my_role() = 'admin'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'read_classes'          AND tablename = 'classes') THEN CREATE POLICY "read_classes" ON classes FOR SELECT USING (get_my_role() IN ('headmaster', 'academic', 'teacher')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_streams'     AND tablename = 'streams') THEN CREATE POLICY "admin_all_streams" ON streams FOR ALL USING (get_my_role() = 'admin'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'read_streams'          AND tablename = 'streams') THEN CREATE POLICY "read_streams" ON streams FOR SELECT USING (get_my_role() IN ('headmaster', 'academic', 'teacher')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_class_streams' AND tablename = 'class_streams') THEN CREATE POLICY "admin_all_class_streams" ON class_streams FOR ALL USING (get_my_role() = 'admin'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'read_class_streams'    AND tablename = 'class_streams') THEN CREATE POLICY "read_class_streams" ON class_streams FOR SELECT USING (get_my_role() IN ('headmaster', 'academic', 'teacher')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academic_rw_class_streams' AND tablename = 'class_streams') THEN CREATE POLICY "academic_rw_class_streams" ON class_streams FOR ALL USING (get_my_role() = 'academic'); END IF;
END $$;

-- ============================================================
-- RLS POLICIES: STUDENTS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_students'           AND tablename = 'students') THEN CREATE POLICY "admin_all_students" ON students FOR ALL USING (get_my_role() = 'admin'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'headmaster_read_students'     AND tablename = 'students') THEN CREATE POLICY "headmaster_read_students" ON students FOR SELECT USING (get_my_role() = 'headmaster'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academic_rw_students'         AND tablename = 'students') THEN CREATE POLICY "academic_rw_students" ON students FOR ALL USING (get_my_role() = 'academic'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'teacher_read_assigned_students' AND tablename = 'students') THEN
    CREATE POLICY "teacher_read_assigned_students" ON students FOR SELECT USING (
      get_my_role() = 'teacher'
      AND class_stream_id IN (
        SELECT ts.class_stream_id
        FROM teacher_subjects ts
        JOIN teachers t ON t.id = ts.teacher_id
        WHERE t.profile_id = auth.uid()
      )
    );
  END IF;
END $$;

-- ============================================================
-- RLS POLICIES: TEACHERS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_teachers'      AND tablename = 'teachers') THEN CREATE POLICY "admin_all_teachers" ON teachers FOR ALL USING (get_my_role() = 'admin'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'headmaster_read_teachers' AND tablename = 'teachers') THEN CREATE POLICY "headmaster_read_teachers" ON teachers FOR SELECT USING (get_my_role() = 'headmaster'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academic_rw_teachers'    AND tablename = 'teachers') THEN CREATE POLICY "academic_rw_teachers" ON teachers FOR ALL USING (get_my_role() = 'academic'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'teacher_read_own_teacher' AND tablename = 'teachers') THEN CREATE POLICY "teacher_read_own_teacher" ON teachers FOR SELECT USING (profile_id = auth.uid() AND get_my_role() = 'teacher'); END IF;
END $$;

-- ============================================================
-- RLS POLICIES: SUBJECTS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_subjects' AND tablename = 'subjects') THEN CREATE POLICY "admin_all_subjects" ON subjects FOR ALL USING (get_my_role() = 'admin'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'read_subjects'      AND tablename = 'subjects') THEN CREATE POLICY "read_subjects" ON subjects FOR SELECT USING (get_my_role() IN ('headmaster', 'academic', 'teacher')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academic_rw_subjects' AND tablename = 'subjects') THEN CREATE POLICY "academic_rw_subjects" ON subjects FOR ALL USING (get_my_role() = 'academic'); END IF;
END $$;

-- ============================================================
-- RLS POLICIES: TEACHER_SUBJECTS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_teacher_subjects'      AND tablename = 'teacher_subjects') THEN CREATE POLICY "admin_all_teacher_subjects" ON teacher_subjects FOR ALL USING (get_my_role() = 'admin'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'headmaster_read_teacher_subjects' AND tablename = 'teacher_subjects') THEN CREATE POLICY "headmaster_read_teacher_subjects" ON teacher_subjects FOR SELECT USING (get_my_role() = 'headmaster'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academic_rw_teacher_subjects'    AND tablename = 'teacher_subjects') THEN CREATE POLICY "academic_rw_teacher_subjects" ON teacher_subjects FOR ALL USING (get_my_role() = 'academic'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'teacher_read_own_subjects'       AND tablename = 'teacher_subjects') THEN
    CREATE POLICY "teacher_read_own_subjects" ON teacher_subjects FOR SELECT USING (
      get_my_role() = 'teacher'
      AND teacher_id IN (
        SELECT id FROM teachers WHERE profile_id = auth.uid()
      )
    );
  END IF;
END $$;

-- ============================================================
-- RLS POLICIES: SUBJECT_ASSIGNMENTS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_subject_assignments'  AND tablename = 'subject_assignments') THEN CREATE POLICY "admin_all_subject_assignments" ON subject_assignments FOR ALL USING (get_my_role() = 'admin'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'read_subject_assignments'       AND tablename = 'subject_assignments') THEN CREATE POLICY "read_subject_assignments" ON subject_assignments FOR SELECT USING (get_my_role() IN ('headmaster', 'academic', 'teacher')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academic_rw_subject_assignments' AND tablename = 'subject_assignments') THEN CREATE POLICY "academic_rw_subject_assignments" ON subject_assignments FOR ALL USING (get_my_role() = 'academic'); END IF;
END $$;

-- ============================================================
-- RLS POLICIES: STUDENT_SUBJECTS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_student_subjects'      AND tablename = 'student_subjects') THEN CREATE POLICY "admin_all_student_subjects" ON student_subjects FOR ALL USING (get_my_role() = 'admin'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'headmaster_read_student_subjects' AND tablename = 'student_subjects') THEN CREATE POLICY "headmaster_read_student_subjects" ON student_subjects FOR SELECT USING (get_my_role() = 'headmaster'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academic_rw_student_subjects'    AND tablename = 'student_subjects') THEN CREATE POLICY "academic_rw_student_subjects" ON student_subjects FOR ALL USING (get_my_role() = 'academic'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'teacher_read_student_subjects'   AND tablename = 'student_subjects') THEN
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

-- ============================================================
-- RLS POLICIES: EXAMS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_exams'      AND tablename = 'exams') THEN CREATE POLICY "admin_all_exams" ON exams FOR ALL USING (get_my_role() = 'admin'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'headmaster_read_exams' AND tablename = 'exams') THEN CREATE POLICY "headmaster_read_exams" ON exams FOR SELECT USING (get_my_role() = 'headmaster'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academic_rw_exams'    AND tablename = 'exams') THEN CREATE POLICY "academic_rw_exams" ON exams FOR ALL USING (get_my_role() = 'academic'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'teacher_read_exams'   AND tablename = 'exams') THEN CREATE POLICY "teacher_read_exams" ON exams FOR SELECT USING (get_my_role() = 'teacher'); END IF;
END $$;

-- ============================================================
-- RLS POLICIES: MARKS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_marks'          AND tablename = 'marks') THEN CREATE POLICY "admin_all_marks" ON marks FOR ALL USING (get_my_role() = 'admin'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'headmaster_read_marks'    AND tablename = 'marks') THEN CREATE POLICY "headmaster_read_marks" ON marks FOR SELECT USING (get_my_role() = 'headmaster'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academic_rw_marks'        AND tablename = 'marks') THEN CREATE POLICY "academic_rw_marks" ON marks FOR ALL USING (get_my_role() = 'academic'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'teacher_manage_own_marks' AND tablename = 'marks') THEN
    CREATE POLICY "teacher_manage_own_marks" ON marks FOR ALL USING (
      get_my_role() = 'teacher'
      AND entered_by = auth.uid()
      AND subject_id IN (
        SELECT ts.subject_id
        FROM teacher_subjects ts
        JOIN teachers t ON t.id = ts.teacher_id
        WHERE t.profile_id = auth.uid()
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'teacher_read_assigned_marks' AND tablename = 'marks') THEN
    CREATE POLICY "teacher_read_assigned_marks" ON marks FOR SELECT USING (
      get_my_role() = 'teacher'
      AND subject_id IN (
        SELECT ts.subject_id
        FROM teacher_subjects ts
        JOIN teachers t ON t.id = ts.teacher_id
        WHERE t.profile_id = auth.uid()
      )
    );
  END IF;
END $$;

-- ============================================================
-- RLS POLICIES: GRADES
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_grades' AND tablename = 'grades') THEN CREATE POLICY "admin_all_grades" ON grades FOR ALL USING (get_my_role() = 'admin'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'read_grades'      AND tablename = 'grades') THEN CREATE POLICY "read_grades" ON grades FOR SELECT USING (get_my_role() IN ('headmaster', 'academic', 'teacher')); END IF;
END $$;

-- ============================================================
-- RLS POLICIES: STUDENT_RESULTS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_student_results'      AND tablename = 'student_results') THEN CREATE POLICY "admin_all_student_results" ON student_results FOR ALL USING (get_my_role() = 'admin'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'headmaster_read_student_results' AND tablename = 'student_results') THEN CREATE POLICY "headmaster_read_student_results" ON student_results FOR SELECT USING (get_my_role() = 'headmaster'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academic_rw_student_results'    AND tablename = 'student_results') THEN CREATE POLICY "academic_rw_student_results" ON student_results FOR ALL USING (get_my_role() = 'academic'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'teacher_read_student_results'   AND tablename = 'student_results') THEN
    CREATE POLICY "teacher_read_student_results" ON student_results FOR SELECT USING (
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

-- ============================================================
-- RLS POLICIES: ATTENDANCE
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_attendance'      AND tablename = 'attendance') THEN CREATE POLICY "admin_all_attendance" ON attendance FOR ALL USING (get_my_role() = 'admin'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'headmaster_read_attendance' AND tablename = 'attendance') THEN CREATE POLICY "headmaster_read_attendance" ON attendance FOR SELECT USING (get_my_role() = 'headmaster'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academic_rw_attendance'    AND tablename = 'attendance') THEN CREATE POLICY "academic_rw_attendance" ON attendance FOR ALL USING (get_my_role() = 'academic'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'teacher_manage_attendance'  AND tablename = 'attendance') THEN
    CREATE POLICY "teacher_manage_attendance" ON attendance FOR ALL USING (
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

-- ============================================================
-- RLS POLICIES: ANNOUNCEMENTS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_announcements'      AND tablename = 'announcements') THEN CREATE POLICY "admin_all_announcements" ON announcements FOR ALL USING (get_my_role() = 'admin'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'headmaster_read_announcements' AND tablename = 'announcements') THEN CREATE POLICY "headmaster_read_announcements" ON announcements FOR SELECT USING (get_my_role() = 'headmaster'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academic_rw_announcements'    AND tablename = 'announcements') THEN CREATE POLICY "academic_rw_announcements" ON announcements FOR ALL USING (get_my_role() = 'academic'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'teacher_read_announcements'   AND tablename = 'announcements') THEN CREATE POLICY "teacher_read_announcements" ON announcements FOR SELECT USING (get_my_role() = 'teacher'); END IF;
END $$;

-- ============================================================
-- RLS POLICIES: AUDIT_LOGS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_audit_logs'      AND tablename = 'audit_logs') THEN CREATE POLICY "admin_all_audit_logs" ON audit_logs FOR ALL USING (get_my_role() = 'admin'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'headmaster_read_audit_logs' AND tablename = 'audit_logs') THEN CREATE POLICY "headmaster_read_audit_logs" ON audit_logs FOR SELECT USING (get_my_role() = 'headmaster'); END IF;
END $$;

-- ============================================================
-- RLS POLICIES: SCHOOL_SETTINGS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_school_settings'  AND tablename = 'school_settings') THEN CREATE POLICY "admin_all_school_settings" ON school_settings FOR ALL USING (get_my_role() = 'admin'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'read_school_settings'       AND tablename = 'school_settings') THEN CREATE POLICY "read_school_settings" ON school_settings FOR SELECT USING (get_my_role() IN ('headmaster', 'academic', 'teacher')); END IF;
END $$;

-- ============================================================
-- RLS POLICIES: CURRICULA
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_curricula'      AND tablename = 'curricula') THEN CREATE POLICY "admin_all_curricula" ON curricula FOR ALL USING (get_my_role() = 'admin'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'read_curricula'           AND tablename = 'curricula') THEN CREATE POLICY "read_curricula" ON curricula FOR SELECT USING (get_my_role() IN ('headmaster', 'academic', 'teacher')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academic_rw_curricula'    AND tablename = 'curricula') THEN CREATE POLICY "academic_rw_curricula" ON curricula FOR ALL USING (get_my_role() = 'academic'); END IF;
END $$;

-- ============================================================
-- RLS POLICIES: COMBINATIONS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_combinations'      AND tablename = 'combinations') THEN CREATE POLICY "admin_all_combinations" ON combinations FOR ALL USING (get_my_role() = 'admin'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'read_combinations'           AND tablename = 'combinations') THEN CREATE POLICY "read_combinations" ON combinations FOR SELECT USING (get_my_role() IN ('headmaster', 'academic', 'teacher')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academic_rw_combinations'    AND tablename = 'combinations') THEN CREATE POLICY "academic_rw_combinations" ON combinations FOR ALL USING (get_my_role() = 'academic'); END IF;
END $$;

-- ============================================================
-- RLS POLICIES: COMBINATION_SUBJECTS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_combination_subjects'      AND tablename = 'combination_subjects') THEN CREATE POLICY "admin_all_combination_subjects" ON combination_subjects FOR ALL USING (get_my_role() = 'admin'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'read_combination_subjects'           AND tablename = 'combination_subjects') THEN CREATE POLICY "read_combination_subjects" ON combination_subjects FOR SELECT USING (get_my_role() IN ('headmaster', 'academic', 'teacher')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academic_rw_combination_subjects'    AND tablename = 'combination_subjects') THEN CREATE POLICY "academic_rw_combination_subjects" ON combination_subjects FOR ALL USING (get_my_role() = 'academic'); END IF;
END $$;

-- ============================================================
-- RLS POLICIES: CLASS_CURRICULA
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_class_curricula'      AND tablename = 'class_curricula') THEN CREATE POLICY "admin_all_class_curricula" ON class_curricula FOR ALL USING (get_my_role() = 'admin'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'read_class_curricula'           AND tablename = 'class_curricula') THEN CREATE POLICY "read_class_curricula" ON class_curricula FOR SELECT USING (get_my_role() IN ('headmaster', 'academic', 'teacher')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academic_rw_class_curricula'    AND tablename = 'class_curricula') THEN CREATE POLICY "academic_rw_class_curricula" ON class_curricula FOR ALL USING (get_my_role() = 'academic'); END IF;
END $$;

-- ============================================================
-- RLS POLICIES: CLASS_COMBINATIONS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_class_combinations'      AND tablename = 'class_combinations') THEN CREATE POLICY "admin_all_class_combinations" ON class_combinations FOR ALL USING (get_my_role() = 'admin'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'read_class_combinations'           AND tablename = 'class_combinations') THEN CREATE POLICY "read_class_combinations" ON class_combinations FOR SELECT USING (get_my_role() IN ('headmaster', 'academic', 'teacher')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academic_rw_class_combinations'    AND tablename = 'class_combinations') THEN CREATE POLICY "academic_rw_class_combinations" ON class_combinations FOR ALL USING (get_my_role() = 'academic'); END IF;
END $$;

-- ============================================================
-- DEFAULT DATA: CLASSES (Form 1–Form 6)
-- ============================================================
INSERT INTO classes (class_name, level, sort_order)
SELECT v.class_name, v.level, v.sort_order
FROM (VALUES
  ('Form 1', 'O_LEVEL', 1),
  ('Form 2', 'O_LEVEL', 2),
  ('Form 3', 'O_LEVEL', 3),
  ('Form 4', 'O_LEVEL', 4),
  ('Form 5', 'A_LEVEL', 5),
  ('Form 6', 'A_LEVEL', 6)
) AS v(class_name, level, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM classes c WHERE c.class_name = v.class_name);

-- ============================================================
-- DEFAULT DATA: STREAMS (A–E)
-- ============================================================
INSERT INTO streams (stream_name)
SELECT v.stream_name
FROM (VALUES ('A'), ('B'), ('C'), ('D'), ('E')) AS v(stream_name)
WHERE NOT EXISTS (SELECT 1 FROM streams s WHERE s.stream_name = v.stream_name);

-- ============================================================
-- DEFAULT DATA: O-LEVEL GRADES (NECTA standard)
-- ============================================================
INSERT INTO grades (min_mark, max_mark, grade, points, remarks, level)
SELECT v.min_mark, v.max_mark, v.grade, v.points, v.remarks, v.level
FROM (VALUES
  (75, 100, 'A',  1, 'Excellent',      'O_LEVEL'),
  (65,  74, 'B',  2, 'Very Good',      'O_LEVEL'),
  (45,  64, 'C',  3, 'Good',           'O_LEVEL'),
  (30,  44, 'D',  4, 'Satisfactory',   'O_LEVEL'),
  ( 0,  29, 'F',  5, 'Fail',           'O_LEVEL')
) AS v(min_mark, max_mark, grade, points, remarks, level)
WHERE NOT EXISTS (SELECT 1 FROM grades g WHERE g.grade = v.grade AND g.level = v.level);

-- ============================================================
-- DEFAULT DATA: A-LEVEL GRADES (NECTA standard)
-- ============================================================
INSERT INTO grades (min_mark, max_mark, grade, points, remarks, level)
SELECT v.min_mark, v.max_mark, v.grade, v.points, v.remarks, v.level
FROM (VALUES
  (80, 100, 'A',  5, 'Excellent',      'A_LEVEL'),
  (70,  79, 'B',  4, 'Very Good',      'A_LEVEL'),
  (60,  69, 'C',  3, 'Good',           'A_LEVEL'),
  (50,  59, 'D',  2, 'Satisfactory',   'A_LEVEL'),
  (40,  49, 'E',  1, 'Pass',           'A_LEVEL'),
  ( 0,  39, 'F',  0, 'Fail',           'A_LEVEL')
) AS v(min_mark, max_mark, grade, points, remarks, level)
WHERE NOT EXISTS (SELECT 1 FROM grades g WHERE g.grade = v.grade AND g.level = v.level);

-- ============================================================
-- DEFAULT DATA: SCHOOL SETTINGS (sample)
-- ============================================================
INSERT INTO school_settings (school_name, school_code, address, phone, email)
SELECT 'Sample Secondary School', 'SSS001', 'P.O. Box 1, Dar es Salaam, Tanzania', '+255 700 000 000', 'info@samplesecondary.ac.tz'
WHERE NOT EXISTS (SELECT 1 FROM school_settings);

-- ============================================================
-- DEFAULT DATA: CURRICULA
-- ============================================================
INSERT INTO curricula (name, level, is_active)
SELECT v.name, v.level, v.is_active
FROM (VALUES
  ('Old Curriculum O-Level', 'O_LEVEL', TRUE),
  ('New Curriculum O-Level', 'O_LEVEL', TRUE),
  ('Old Curriculum A-Level', 'A_LEVEL', TRUE),
  ('New Curriculum A-Level', 'A_LEVEL', TRUE)
) AS v(name, level, is_active)
WHERE NOT EXISTS (SELECT 1 FROM curricula c WHERE c.name = v.name);

-- ============================================================
-- DEFAULT DATA: CLASS CURRICULA
-- Form 1 & 2 use New Curriculum O-Level
-- Form 3 & 4 use Old Curriculum O-Level
-- ============================================================
INSERT INTO class_curricula (class_id, curriculum_id)
SELECT c.id, cu.id
FROM classes c
CROSS JOIN curricula cu
WHERE (c.class_name, cu.name) IN (
  ('Form 1', 'New Curriculum O-Level'),
  ('Form 2', 'New Curriculum O-Level'),
  ('Form 3', 'Old Curriculum O-Level'),
  ('Form 4', 'Old Curriculum O-Level')
)
AND NOT EXISTS (
  SELECT 1 FROM class_curricula cc
  WHERE cc.class_id = c.id
);

-- ============================================================
-- DEFAULT DATA: SAMPLE A-LEVEL COMBINATIONS
-- ============================================================
-- These will reference the curricula above. They only insert if
-- the combination code doesn't already exist.
INSERT INTO combinations (name, code, curriculum_id)
SELECT v.name, v.code, c.id
FROM (VALUES
  ('Physics Chemistry Mathematics', 'PCM', 'Old Curriculum A-Level'),
  ('Physics Chemistry Biology',      'PCB', 'Old Curriculum A-Level'),
  ('History Geography Literature',    'HGL', 'Old Curriculum A-Level'),
  ('Economics Geography Mathematics', 'EGM', 'Old Curriculum A-Level'),
  ('Chemistry Biology Geography',     'CBG', 'Old Curriculum A-Level'),
  ('Physics Advanced Mathematics',    'PAM', 'Old Curriculum A-Level')
) AS v(name, code, curriculum_name)
JOIN curricula c ON c.name = v.curriculum_name
WHERE NOT EXISTS (SELECT 1 FROM combinations x WHERE x.code = v.code);

-- ============================================================
-- FUNCTION: Register a teacher (creates auth user, profile, teacher record)
-- Bypasses signup rate limits by using SECURITY DEFINER + auth.create_user()
-- ============================================================
-- ============================================================
-- NOTE: register_teacher was previously here as a plpgsql
-- function using auth.create_user(). That approach caused
-- "Unexpected token" HTML errors because auth.create_user()
-- is unreliable in plpgsql context. It has been replaced by
-- a Vercel serverless route at /api/register-teacher that
-- uses supabase.auth.admin.createUser() server-side.
-- See api/register-teacher.js
-- ============================================================
DROP FUNCTION IF EXISTS public.register_teacher;

-- ============================================================
-- Make curriculum_id nullable in combinations (curriculum removed for A-Level)
-- ============================================================
ALTER TABLE combinations ALTER COLUMN curriculum_id DROP NOT NULL;

-- ============================================================
-- END OF SCHEMA
-- ============================================================
