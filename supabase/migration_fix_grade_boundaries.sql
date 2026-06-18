-- ============================================================
-- FIX: Grade boundary gaps — use >= min_mark with ORDER BY DESC
-- 
-- BUG: AND v_average <= g.max_mark with integer boundaries creates
-- gaps (e.g., 74.56 is > B.max=74 AND < A.min=75, matching NO grade).
-- Using >= min_mark with ORDER BY min_mark DESC (highest first) and
-- LIMIT 1 picks the correct grade without gaps.
-- ============================================================

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
    v_max_mark := CASE WHEN rec.has_practical THEN 150 ELSE 100 END;
    v_raw_total := v_raw_total + rec.marks_obtained + rec.practical_marks;

    IF rec.is_absent OR v_max_mark <= 0 THEN
      v_sub_pct := 0;
    ELSE
      v_sub_pct := (rec.marks_obtained + rec.practical_marks) / v_max_mark * 100;
    END IF;

    v_pct_total := v_pct_total + v_sub_pct;

    IF NOT rec.is_absent THEN
      v_count := v_count + 1;
    END IF;

    -- FIXED: Use >= min_mark with ORDER BY DESC to avoid boundary gaps
    IF NOT rec.is_absent THEN
      SELECT g.points INTO v_points
      FROM grades g
      WHERE g.level = COALESCE(v_level, rec.sub_level)
        AND v_sub_pct >= g.min_mark
      ORDER BY g.min_mark DESC
      LIMIT 1;
      v_points_sum := v_points_sum + COALESCE(v_points, 0);
    END IF;
  END LOOP;

  IF v_count > 0 THEN
    v_average := v_pct_total / v_count;
  ELSE
    v_average := 0;
  END IF;

  -- FIXED: Use >= min_mark with ORDER BY DESC to avoid boundary gaps
  v_grade := 'F';
  SELECT g.grade INTO v_grade
  FROM grades g
  WHERE g.level = COALESCE(v_level, 'O_LEVEL')
    AND v_average >= g.min_mark
  ORDER BY g.min_mark DESC
  LIMIT 1;

  IF v_grade IS NULL THEN
    v_grade := 'F';
  END IF;

  IF COALESCE(v_level, 'O_LEVEL') = 'O_LEVEL' THEN
    v_division := calculate_o_level_division(v_points_sum);
  ELSE
    v_division := calculate_a_level_division(v_points_sum);
  END IF;

  IF v_division IS NULL THEN
    v_division := 'N/A';
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
