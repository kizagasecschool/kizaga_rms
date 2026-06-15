-- ============================================================
-- FIX: compute_student_result to handle practical subjects
-- Practical subjects have max = 150 (theory 100 + practical 50)
-- Non-practical subjects have max = 100
-- Average must be computed on percentage basis, not raw marks.
-- ============================================================

-- 1. Ensure has_practical is set for science subjects
UPDATE subjects SET has_practical = TRUE
WHERE UPPER(subject_code) IN ('CHEM', 'PHY', 'BIOS', 'BIO')
  AND NOT has_practical;

-- 2. Clear has_practical for non-science O-Level subjects
UPDATE subjects SET has_practical = FALSE
WHERE level = 'O_LEVEL'
  AND UPPER(subject_code) NOT IN ('CHEM', 'PHY', 'BIOS', 'BIO')
  AND has_practical;

-- 3. Replace compute_student_result with percentage-based averaging
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
      m.marks_obtained,
      COALESCE(m.practical_marks, 0) AS practical_marks,
      sub.level AS sub_level,
      sub.has_practical,
      m.is_absent
    FROM marks m
    JOIN subjects sub ON sub.id = m.subject_id
    WHERE m.student_id = p_student_id AND m.exam_id = p_exam_id
  LOOP
    -- Practical subject: max = 150 (theory 100 + practical 50)
    -- Non-practical: max = 100
    v_max_mark := CASE WHEN rec.has_practical THEN 150 ELSE 100 END;

    -- Convert to percentage: (theory + prac) / max * 100
    IF v_max_mark > 0 THEN
      v_sub_pct := (rec.marks_obtained + rec.practical_marks) / v_max_mark * 100;
    ELSE
      v_sub_pct := 0;
    END IF;

    v_total := v_total + v_sub_pct;

    IF NOT rec.is_absent THEN
      v_count := v_count + 1;
    END IF;

    -- Grade points based on theory mark only (Tanzanian system convention)
    SELECT g.points INTO v_points
    FROM grades g
    WHERE g.level = COALESCE(v_level, rec.sub_level)
      AND (rec.marks_obtained + rec.practical_marks) >= g.min_mark
      AND (rec.marks_obtained + rec.practical_marks) <= g.max_mark
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
    total_marks    = EXCLUDED.total_marks,
    average_marks  = EXCLUDED.average_marks,
    grade          = EXCLUDED.grade,
    division       = EXCLUDED.division,
    updated_at     = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
