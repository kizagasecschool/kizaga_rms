-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text,
  full_name text,
  role text NOT NULL DEFAULT 'teacher'::text CHECK (role = ANY (ARRAY['admin'::text, 'headmaster'::text, 'academic'::text, 'teacher'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.academic_years (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  year_name text NOT NULL UNIQUE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT academic_years_pkey PRIMARY KEY (id)
);
CREATE TABLE public.terms (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  academic_year_id uuid NOT NULL,
  term_name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT terms_pkey PRIMARY KEY (id),
  CONSTRAINT terms_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id)
);
CREATE TABLE public.classes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  class_name text NOT NULL UNIQUE,
  level text NOT NULL CHECK (level = ANY (ARRAY['O_LEVEL'::text, 'A_LEVEL'::text])),
  sort_order integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT classes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.streams (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  stream_name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT streams_pkey PRIMARY KEY (id)
);
CREATE TABLE public.class_streams (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  class_id uuid NOT NULL,
  stream_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT class_streams_pkey PRIMARY KEY (id),
  CONSTRAINT class_streams_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id),
  CONSTRAINT class_streams_stream_id_fkey FOREIGN KEY (stream_id) REFERENCES public.streams(id)
);
CREATE TABLE public.students (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  admission_number text NOT NULL UNIQUE,
  first_name text NOT NULL,
  middle_name text,
  surname text NOT NULL,
  gender text NOT NULL CHECK (gender = ANY (ARRAY['Male'::text, 'Female'::text])),
  date_of_birth date NOT NULL,
  class_stream_id uuid,
  admission_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'graduated'::text, 'transferred'::text, 'expelled'::text])),
  parent_name text,
  parent_phone text,
  address text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT students_pkey PRIMARY KEY (id),
  CONSTRAINT students_class_stream_id_fkey FOREIGN KEY (class_stream_id) REFERENCES public.class_streams(id)
);
CREATE TABLE public.teachers (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  employee_number text NOT NULL UNIQUE,
  profile_id uuid NOT NULL,
  qualification text,
  phone text,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'on_leave'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT teachers_pkey PRIMARY KEY (id),
  CONSTRAINT teachers_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.subjects (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  subject_code text NOT NULL UNIQUE,
  subject_name text NOT NULL,
  subject_type text NOT NULL CHECK (subject_type = ANY (ARRAY['COMPULSORY'::text, 'OPTIONAL'::text, 'ELECTIVE'::text])),
  level text NOT NULL CHECK (level = ANY (ARRAY['O_LEVEL'::text, 'A_LEVEL'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  curriculum text CHECK (curriculum = ANY (ARRAY['OLD'::text, 'NEW'::text])),
  CONSTRAINT subjects_pkey PRIMARY KEY (id)
);
CREATE TABLE public.teacher_subjects (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  teacher_id uuid NOT NULL,
  class_stream_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT teacher_subjects_pkey PRIMARY KEY (id),
  CONSTRAINT teacher_subjects_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id),
  CONSTRAINT teacher_subjects_class_stream_id_fkey FOREIGN KEY (class_stream_id) REFERENCES public.class_streams(id),
  CONSTRAINT teacher_subjects_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id)
);
CREATE TABLE public.subject_assignments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  subject_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  class_id uuid NOT NULL,
  CONSTRAINT subject_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT subject_assignments_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT subject_assignments_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id)
);
CREATE TABLE public.exams (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  exam_name text NOT NULL,
  term_id uuid NOT NULL,
  academic_year_id uuid NOT NULL,
  exam_type text NOT NULL CHECK (exam_type = ANY (ARRAY['MONTHLY'::text, 'MIDTERM'::text, 'TERMINAL'::text, 'MOCK'::text, 'ANNUAL'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT exams_pkey PRIMARY KEY (id),
  CONSTRAINT exams_term_id_fkey FOREIGN KEY (term_id) REFERENCES public.terms(id),
  CONSTRAINT exams_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id)
);
CREATE TABLE public.marks (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  exam_id uuid NOT NULL,
  marks_obtained numeric NOT NULL CHECK (marks_obtained >= 0::numeric AND marks_obtained <= 100::numeric),
  entered_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT marks_pkey PRIMARY KEY (id),
  CONSTRAINT marks_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT marks_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT marks_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id),
  CONSTRAINT marks_entered_by_fkey FOREIGN KEY (entered_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.grades (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  min_mark numeric NOT NULL,
  max_mark numeric NOT NULL,
  grade text NOT NULL,
  points integer NOT NULL,
  remarks text NOT NULL,
  level text NOT NULL CHECK (level = ANY (ARRAY['O_LEVEL'::text, 'A_LEVEL'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT grades_pkey PRIMARY KEY (id)
);
CREATE TABLE public.student_results (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL,
  exam_id uuid NOT NULL,
  total_marks numeric NOT NULL DEFAULT 0,
  average_marks numeric NOT NULL DEFAULT 0,
  grade text,
  division text,
  position integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT student_results_pkey PRIMARY KEY (id),
  CONSTRAINT student_results_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT student_results_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id)
);
CREATE TABLE public.attendance (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL,
  date date NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['present'::text, 'absent'::text, 'late'::text, 'excused'::text])),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT attendance_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
);
CREATE TABLE public.announcements (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  content text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT announcements_pkey PRIMARY KEY (id),
  CONSTRAINT announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.school_settings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  school_name text NOT NULL,
  school_code text NOT NULL UNIQUE,
  address text,
  phone text,
  email text,
  logo_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT school_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.combinations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  combination_name text NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT combinations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.combination_subjects (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  combination_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  subject_role text NOT NULL CHECK (subject_role = ANY (ARRAY['CORE'::text, 'SUBSIDIARY'::text, 'OPTIONAL'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT combination_subjects_pkey PRIMARY KEY (id),
  CONSTRAINT combination_subjects_combination_id_fkey FOREIGN KEY (combination_id) REFERENCES public.combinations(id),
  CONSTRAINT combination_subjects_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id)
);
CREATE TABLE public.student_subjects (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT student_subjects_pkey PRIMARY KEY (id),
  CONSTRAINT student_subjects_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT student_subjects_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id)
);