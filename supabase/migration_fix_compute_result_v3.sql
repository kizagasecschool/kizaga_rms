-- ============================================================
-- Migration: Fix compute_student_result issues
-- Issues fixed:
-- 1. Average uses raw-sum instead of percentage (can exceed 100, no grade matched)
-- 2. A-Level filter uses '!= ELECTIVE' but A-Level subjects are 'PRINCIPAL'/'SUBSIDIARY'
-- 3. marks_obtained has no COALESCE — NULL causes total to become NULL
-- 4. Points lookup uses raw marks_obtained instead of percentage
-- 5. is_absent: total should not include absent marks
-- Run AFTER migration_grading_update.sql
-- ============================================================

CREATE OR REPLACE FUNCTION compute_student_result(p_student_id UUID, p_exam_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total             NUMERIC := 0;
  v_count             INTEGER := 0;
  v_average           NUMERIC := 0;
  v_grade             TEXT;
  v_division          TEXT;
  v_level             TEXT;
  v_points_sum        INTEGER := 0;
  v_points            INTEGER;
  v_principal_points  INTEGER[] := '{}';
  v_filtered          INTEGER[];
  v_i                 INTEGER;
  v_best3_sum         INTEGER := 0;
  v_sub_pct           NUMERIC;
  v_max               NUMERIC;
  rec                 RECORD;
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
      sub.subject_type,
      m.is_absent
    FROM marks m
    JOIN subjects sub ON sub.id = m.subject_id
    WHERE m.student_id = p_student_id AND m.exam_id = p_exam_id
  LOOP
    IF rec.is_absent THEN
      CONTINUE;
    END IF;

    v_max := CASE WHEN rec.has_practical THEN 150 ELSE 100 END;
    v_sub_pct := ((rec.marks_obtained + rec.practical_marks) / v_max) * 100;

    v_total := v_total + v_sub_pct;
    v_count := v_count + 1;

    -- Points based on percentage (normalised 0-100)
    SELECT g.points INTO v_points
    FROM grades g
    WHERE g.level = COALESCE(v_level, rec.sub_level)
      AND v_sub_pct >= g.min_mark
      AND v_sub_pct <= g.max_mark
    ORDER BY g.min_mark DESC
    LIMIT 1;
    v_points := COALESCE(v_points, 0);
    v_points_sum := v_points_sum + v_points;

    -- For A-Level: only PRINCIPAL subjects count toward division
    IF COALESCE(v_level, 'O_LEVEL') = 'A_LEVEL' AND rec.subject_type = 'PRINCIPAL' AND v_points > 0 THEN
      v_principal_points := array_append(v_principal_points, v_points);
    END IF;
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
    -- A-Level: sort principal points ascending, take best 3 (lowest points)
    IF array_length(v_principal_points, 1) IS NOT NULL THEN
      v_filtered := (SELECT ARRAY(SELECT unnest(v_principal_points) AS p ORDER BY p LIMIT 3));
      v_best3_sum := 0;
      FOREACH v_i IN ARRAY v_filtered LOOP
        v_best3_sum := v_best3_sum + v_i;
      END LOOP;
      v_division := calculate_a_level_division(v_best3_sum);
    ELSE
      v_division := 'Division 0';
    END IF;
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
