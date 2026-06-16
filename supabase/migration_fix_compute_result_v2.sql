-- ============================================================
-- FIX: compute_student_result — final correct version
-- 1. Percentage-based averaging for practical subjects (max 150)
-- 2. Points lookup uses percentage, NOT raw marks (fixes bug
--    where raw combined marks 0-150 were compared against 
--    percentage thresholds 0-100)
-- 3. A-Level uses calculate_a_level_division (not old GPA)
-- 4. total_marks = raw sum (for display)
--    average_marks = percentage-based average (for grade lookup)
-- ============================================================

-- Ensure calculate_a_level_division exists
CREATE OR REPLACE FUNCTION calculate_a_level_division(p_total_points INTEGER)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE
    WHEN p_total_points BETWEEN 3  AND 9  THEN 'Division I'
    WHEN p_total_points BETWEEN 10 AND 12 THEN 'Division II'
    WHEN p_total_points BETWEEN 13 AND 17 THEN 'Division III'
    WHEN p_total_points BETWEEN 18 AND 19 THEN 'Division IV'
    ELSE 'Division 0'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Replace compute_student_result
CREATE OR REPLACE FUNCTION compute_student_result(p_student_id UUID, p_exam_id UUID)
RETURNS VOID AS $$
DECLARE
  v_raw_total   NUMERIC := 0;
  v_pct_total   NUMERIC := 0;
  v_count       INTEGER := 0;
  v_average     NUMERIC := 0;
  v_grade       TEXT;
  v_division    TEXT;
  v_level       TEXT;
  v_points_sum  INTEGER := 0;
  v_points      INTEGER;
  rec           RECORD;
  v_sub_pct     NUMERIC;
  v_max_mark    NUMERIC;
BEGIN
  SELECT c.level INTO v_level
  FROM students s
  JOIN class_streams cs ON cs.id = s.class_stream_id
  JOIN classes c ON c.id = cs.class_id
  WHERE s.id = p_student_id;

  FOR rec IN
    SELECT
      COALESCE(m.marks_obtained, 0) AS marks_obtained,
      COALESCE(m.practical_marks, 0) AS practical_marks,
      sub.level AS sub_level,
      sub.has_practical,
      m.is_absent
    FROM marks m
    JOIN subjects sub ON sub.id = m.subject_id
    WHERE m.student_id = p_student_id AND m.exam_id = p_exam_id
  LOOP
    -- Max: 150 for practical subjects (100 theory + 50 practical), 100 otherwise
    v_max_mark := CASE WHEN rec.has_practical THEN 150 ELSE 100 END;

    -- Raw sum (for display in total_marks)
    v_raw_total := v_raw_total + rec.marks_obtained + rec.practical_marks;

    -- Convert to percentage for fair averaging
    IF rec.is_absent OR v_max_mark <= 0 THEN
      v_sub_pct := 0;
    ELSE
      v_sub_pct := (rec.marks_obtained + rec.practical_marks) / v_max_mark * 100;
    END IF;

    v_pct_total := v_pct_total + v_sub_pct;

    IF NOT rec.is_absent THEN
      v_count := v_count + 1;
    END IF;

    -- Grade points based on PERCENTAGE, not raw marks
    IF NOT rec.is_absent THEN
      SELECT g.points INTO v_points
      FROM grades g
      WHERE g.level = COALESCE(v_level, rec.sub_level)
        AND v_sub_pct >= g.min_mark
        AND v_sub_pct <= g.max_mark
      LIMIT 1;
      v_points_sum := v_points_sum + COALESCE(v_points, 0);
    END IF;
  END LOOP;

  -- Percentage-based average
  IF v_count > 0 THEN
    v_average := v_pct_total / v_count;
  ELSE
    v_average := 0;
  END IF;

  -- Overall grade from average percentage
  SELECT g.grade INTO v_grade
  FROM grades g
  WHERE g.level = COALESCE(v_level, 'O_LEVEL')
    AND v_average >= g.min_mark
    AND v_average <= g.max_mark
  LIMIT 1;

  -- Division based on total points
  IF COALESCE(v_level, 'O_LEVEL') = 'O_LEVEL' THEN
    v_division := calculate_o_level_division(v_points_sum);
  ELSE
    v_division := calculate_a_level_division(v_points_sum);
  END IF;

  INSERT INTO student_results (student_id, exam_id, total_marks, average_marks, grade, division)
  VALUES (p_student_id, p_exam_id, v_raw_total, v_average, v_grade, v_division)
  ON CONFLICT (student_id, exam_id)
  DO UPDATE SET
    total_marks    = EXCLUDED.total_marks,
    average_marks  = EXCLUDED.average_marks,
    grade          = EXCLUDED.grade,
    division       = EXCLUDED.division,
    updated_at     = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
