-- ============================================================
-- EXAM REGISTRATION & MARK ENTRY SYSTEM
-- Extends schema for full exam lifecycle with status workflow,
-- practical marks, class-level exam targeting, and
-- academic-as-teacher RLS for marks entry.
-- Idempotent: safe to run multiple times.
-- ============================================================

-- ============================================================
-- 1. SUBJECTS: add has_practical flag
-- ============================================================
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS has_practical BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================
-- 2. EXAMS: extend columns and update constraints
-- ============================================================

-- Drop old CHECK constraint so we can widen exam_type
ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_exam_type_check;

-- Add new columns
ALTER TABLE exams ADD COLUMN IF NOT EXISTS start_date    DATE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS end_date      DATE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS has_practical BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS status        TEXT NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft', 'entering_marks', 'processed', 'published', 'locked'));

-- Re-add CHECK with superset of types (existing rows already match subset)
ALTER TABLE exams ADD CONSTRAINT exams_exam_type_check
  CHECK (exam_type IN ('WEEKLY','MONTHLY','MIDTERM_1','TERMINAL','MIDTERM_2','ANNUAL',
                       'SERIES_1','SERIES_2','SERIES_3','MOCK','PRE_NATIONAL'));

-- Drop exam_name in favour of name (existing table had exam_name)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exams' AND column_name = 'exam_name') THEN
    ALTER TABLE exams RENAME COLUMN exam_name TO name;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_exams_status ON exams(status);

-- ============================================================
-- 3. EXAM_CLASSES junction table
-- ============================================================
CREATE TABLE IF NOT EXISTS exam_classes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id    UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  class_id   UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_classes_exam   ON exam_classes(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_classes_class  ON exam_classes(class_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_exam_class') THEN
    ALTER TABLE exam_classes ADD CONSTRAINT uq_exam_class UNIQUE (exam_id, class_id);
  END IF;
END $$;

-- ============================================================
-- 4. MARKS: add practical_marks column
-- ============================================================
ALTER TABLE marks ADD COLUMN IF NOT EXISTS practical_marks NUMERIC(5,2)
  CHECK (practical_marks IS NULL OR (practical_marks >= 0 AND practical_marks <= 50));

-- Widen marks_obtained check to 100 (already done) – ensure constraint allows it
ALTER TABLE marks DROP CONSTRAINT IF EXISTS marks_marks_obtained_check;
ALTER TABLE marks ADD CONSTRAINT marks_marks_obtained_check
  CHECK (marks_obtained >= 0 AND marks_obtained <= 100);

-- ============================================================
-- 5. UPDATE compute_student_result() for practical marks
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
    SELECT
      m.marks_obtained,
      COALESCE(m.practical_marks, 0) AS practical_marks,
      sub.level AS sub_level,
      sub.has_practical
    FROM marks m
    JOIN subjects sub ON sub.id = m.subject_id
    WHERE m.student_id = p_student_id AND m.exam_id = p_exam_id
  LOOP
    v_total := v_total + rec.marks_obtained + rec.practical_marks;
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
-- 6. RLS POLICIES: EXAM_CLASSES
-- ============================================================
ALTER TABLE exam_classes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_all_exam_classes'       AND tablename = 'exam_classes') THEN
    CREATE POLICY "admin_all_exam_classes" ON exam_classes FOR ALL USING (get_my_role() = 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'headmaster_read_exam_classes'  AND tablename = 'exam_classes') THEN
    CREATE POLICY "headmaster_read_exam_classes" ON exam_classes FOR SELECT USING (get_my_role() = 'headmaster');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academic_rw_exam_classes'      AND tablename = 'exam_classes') THEN
    CREATE POLICY "academic_rw_exam_classes" ON exam_classes FOR ALL USING (get_my_role() = 'academic');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'teacher_read_exam_classes'     AND tablename = 'exam_classes') THEN
    CREATE POLICY "teacher_read_exam_classes" ON exam_classes FOR SELECT USING (get_my_role() = 'teacher');
  END IF;
END $$;

-- ============================================================
-- 7. UPDATE RLS POLICIES: EXAMS – academic can manage all statuses
-- ============================================================
-- (Existing policies already give academic ALL on exams – no change needed)

-- ============================================================
-- 8. UPDATE RLS POLICIES: MARKS – allow academic+teacher to
--    enter marks for subjects they are assigned to
-- ============================================================
-- Drop old teacher policy to replace with one that also covers academic role
DROP POLICY IF EXISTS "teacher_manage_own_marks" ON marks;
DROP POLICY IF EXISTS "teacher_read_assigned_marks" ON marks;

-- Policy: academic OR teacher can INSERT/UPDATE marks for their assigned subjects
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'staff_manage_own_marks' AND tablename = 'marks') THEN
    CREATE POLICY "staff_manage_own_marks" ON marks FOR INSERT WITH CHECK (
      get_my_role() IN ('academic', 'teacher')
      AND entered_by = auth.uid()
      AND subject_id IN (
        SELECT ts.subject_id
        FROM teacher_subjects ts
        JOIN teachers t ON t.id = ts.teacher_id
        WHERE t.profile_id = auth.uid()
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'staff_update_own_marks' AND tablename = 'marks') THEN
    CREATE POLICY "staff_update_own_marks" ON marks FOR UPDATE USING (
      get_my_role() IN ('academic', 'teacher')
      AND entered_by = auth.uid()
      AND subject_id IN (
        SELECT ts.subject_id
        FROM teacher_subjects ts
        JOIN teachers t ON t.id = ts.teacher_id
        WHERE t.profile_id = auth.uid()
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'staff_read_assigned_marks' AND tablename = 'marks') THEN
    CREATE POLICY "staff_read_assigned_marks" ON marks FOR SELECT USING (
      get_my_role() IN ('academic', 'teacher')
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
-- 9. SEED has_practical for science subjects
-- ============================================================
UPDATE subjects SET has_practical = TRUE
WHERE subject_code IN ('CHEM', 'PHY', 'BIO')
  AND NOT has_practical;

-- ============================================================
-- 10. CREATE FUNCTION: transition_exam_status
-- ============================================================
CREATE OR REPLACE FUNCTION transition_exam_status(p_exam_id UUID, p_new_status TEXT)
RETURNS VOID AS $$
DECLARE
  v_current TEXT;
BEGIN
  SELECT status INTO v_current FROM exams WHERE id = p_exam_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam not found';
  END IF;

  -- Valid transitions
  CASE v_current
    WHEN 'draft' THEN
      IF p_new_status NOT IN ('entering_marks') THEN
        RAISE EXCEPTION 'Can only transition from draft to entering_marks';
      END IF;
    WHEN 'entering_marks' THEN
      IF p_new_status NOT IN ('processed') THEN
        RAISE EXCEPTION 'Can only transition from entering_marks to processed';
      END IF;
    WHEN 'processed' THEN
      IF p_new_status NOT IN ('published') THEN
        RAISE EXCEPTION 'Can only transition from processed to published';
      END IF;
    WHEN 'published' THEN
      IF p_new_status NOT IN ('locked') THEN
        RAISE EXCEPTION 'Can only transition from published to locked';
      END IF;
    WHEN 'locked' THEN
      RAISE EXCEPTION 'Cannot transition a locked exam';
    ELSE
      RAISE EXCEPTION 'Unknown current status: %', v_current;
  END CASE;

  UPDATE exams SET status = p_new_status, updated_at = NOW()
  WHERE id = p_exam_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 11. EXAM STATUS ENFORCEMENT TRIGGER ON MARKS
-- Prevents inserting/updating marks when exam is not in entering_marks
-- ============================================================
CREATE OR REPLACE FUNCTION trg_check_exam_status()
RETURNS TRIGGER AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM exams WHERE id = NEW.exam_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Exam not found';
  END IF;
  IF v_status NOT IN ('entering_marks', 'draft') THEN
    RAISE EXCEPTION 'Cannot modify marks when exam status is %', v_status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_marks_check_exam_status ON marks;
CREATE TRIGGER trg_marks_check_exam_status
  BEFORE INSERT OR UPDATE ON marks
  FOR EACH ROW EXECUTE FUNCTION trg_check_exam_status();

-- ============================================================
-- 12. FUNCTION: process_exam – compute all results & rankings
-- Called when exam transitions to 'processed'
-- ============================================================
CREATE OR REPLACE FUNCTION process_exam(p_exam_id UUID)
RETURNS VOID AS $$
DECLARE
  student_rec RECORD;
BEGIN
  -- Compute result for every student associated with a class in this exam
  FOR student_rec IN
    SELECT DISTINCT s.id AS student_id
    FROM students s
    JOIN class_streams cs ON s.class_stream_id = cs.id
    JOIN classes c ON cs.class_id = c.id
    JOIN exam_classes ec ON c.id = ec.class_id
    WHERE ec.exam_id = p_exam_id
  LOOP
    PERFORM compute_student_result(student_rec.student_id, p_exam_id);
  END LOOP;

  -- Update class rankings
  PERFORM update_class_rankings(p_exam_id);
END;
$$ LANGUAGE plpgsql;
