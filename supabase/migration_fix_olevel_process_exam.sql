-- Fix: process_exam and compute_student_result for O-Level students
-- O-Level students have class_stream_id = NULL, so inner joins on that
-- column excluded them entirely from result processing and rankings.

-- Fix process_exam: use COALESCE(s.class_id, cs.class_id) with LEFT JOIN
CREATE OR REPLACE FUNCTION process_exam(p_exam_id UUID)
RETURNS VOID AS $$
DECLARE
  student_rec RECORD;
BEGIN
  FOR student_rec IN
    SELECT DISTINCT s.id AS student_id
    FROM students s
    LEFT JOIN class_streams cs ON cs.id = s.class_stream_id
    JOIN exam_classes ec ON ec.class_id = COALESCE(s.class_id, cs.class_id)
    WHERE ec.exam_id = p_exam_id
      AND s.status = 'active'
  LOOP
    PERFORM compute_student_result(student_rec.student_id, p_exam_id);
  END LOOP;

  PERFORM update_class_rankings(p_exam_id);
END;
$$ LANGUAGE plpgsql;

-- Fix compute_student_result: get level via class_id (O-Level) or class_streams (A-Level)
CREATE OR REPLACE FUNCTION compute_student_result(p_student_id UUID, p_exam_id UUID)
RETURNS VOID AS $$
DECLARE
  v_raw_total          NUMERIC := 0;
  v_pct_total          NUMERIC := 0;
  v_count              INTEGER := 0;
  v_average            NUMERIC := 0;
  v_grade              TEXT;
  v_division           TEXT;
  v_level              TEXT;
  v_points_sum         INTEGER := 0;
  v_points             INTEGER;
  rec                  RECORD;
  v_sub_pct            NUMERIC;
  v_max_mark           NUMERIC;
  v_all_points         INTEGER[] := '{}';
  v_best_count         CONSTANT INTEGER := 7;
  v_exam_has_practical BOOLEAN;
BEGIN
  -- O-Level students have class_id set and class_stream_id = NULL.
  -- A-Level students have class_stream_id set. Use COALESCE to handle both.
  SELECT c.level INTO v_level
  FROM students s
  LEFT JOIN class_streams cs ON cs.id = s.class_stream_id
  JOIN classes c ON c.id = COALESCE(s.class_id, cs.class_id)
  WHERE s.id = p_student_id;

  SELECT has_practical INTO v_exam_has_practical FROM exams WHERE id = p_exam_id;

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
    v_max_mark := CASE WHEN v_exam_has_practical AND rec.has_practical THEN 150 ELSE 100 END;
    v_raw_total := v_raw_total + rec.marks_obtained + rec.practical_marks;
    IF rec.is_absent OR v_max_mark <= 0 THEN
      v_sub_pct := 0;
    ELSE
      v_sub_pct := (rec.marks_obtained + rec.practical_marks) / v_max_mark * 100;
    END IF;
    v_pct_total := v_pct_total + v_sub_pct;
    IF NOT rec.is_absent THEN
      v_count := v_count + 1;
      SELECT g.points INTO v_points
      FROM grades g
      WHERE g.level = COALESCE(v_level, rec.sub_level)
        AND v_sub_pct >= g.min_mark
        AND v_sub_pct <= g.max_mark
      LIMIT 1;
      v_all_points := array_append(v_all_points, COALESCE(v_points, 0));
    END IF;
  END LOOP;

  IF v_count > 0 THEN
    v_average := v_pct_total / v_count;
  ELSE
    v_average := 0;
  END IF;

  v_grade := 'F';
  SELECT g.grade INTO v_grade
  FROM grades g
  WHERE g.level = COALESCE(v_level, 'O_LEVEL')
    AND v_average >= g.min_mark
    AND v_average <= g.max_mark
  LIMIT 1;
  IF v_grade IS NULL THEN v_grade := 'F'; END IF;

  IF COALESCE(v_level, 'O_LEVEL') = 'O_LEVEL' THEN
    IF array_length(v_all_points, 1) IS NOT NULL THEN
      SELECT COALESCE(SUM(p), 0) INTO v_points_sum
      FROM (SELECT unnest(v_all_points) AS p ORDER BY p ASC LIMIT v_best_count) best;
    END IF;
    v_division := calculate_o_level_division(v_points_sum);
  ELSE
    IF array_length(v_all_points, 1) IS NOT NULL THEN
      SELECT COALESCE(SUM(p), 0) INTO v_points_sum FROM unnest(v_all_points) AS p;
    END IF;
    v_division := calculate_a_level_division(v_points_sum);
  END IF;

  IF v_division IS NULL THEN v_division := 'N/A'; END IF;

  INSERT INTO student_results (student_id, exam_id, total_marks, average_marks, grade, division)
  VALUES (p_student_id, p_exam_id, v_raw_total, v_average, v_grade, v_division)
  ON CONFLICT (student_id, exam_id)
  DO UPDATE SET
    total_marks  = EXCLUDED.total_marks,
    average_marks = EXCLUDED.average_marks,
    grade        = EXCLUDED.grade,
    division     = EXCLUDED.division,
    updated_at   = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

NOTIFY pgrst, 'reload schema';
