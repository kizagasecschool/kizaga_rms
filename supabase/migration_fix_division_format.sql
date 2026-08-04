-- Fix: Division format and A-Level division logic
-- 1. Division calculators return 'I','II','III','IV','0' (not 'Division I' etc.)
-- 2. compute_student_result: A-Level uses best 3 COMPULSORY subjects (not all)
-- 3. Strip existing 'Division ' prefix from student_results

CREATE OR REPLACE FUNCTION calculate_o_level_division(p_total_points INTEGER)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE
    WHEN p_total_points BETWEEN 7  AND 17 THEN 'I'
    WHEN p_total_points BETWEEN 18 AND 21 THEN 'II'
    WHEN p_total_points BETWEEN 22 AND 25 THEN 'III'
    WHEN p_total_points BETWEEN 26 AND 33 THEN 'IV'
    ELSE '0'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION calculate_a_level_division(p_total_points INTEGER)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE
    WHEN p_total_points BETWEEN 3  AND 9  THEN 'I'
    WHEN p_total_points BETWEEN 10 AND 12 THEN 'II'
    WHEN p_total_points BETWEEN 13 AND 17 THEN 'III'
    WHEN p_total_points BETWEEN 18 AND 19 THEN 'IV'
    ELSE '0'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fix compute_student_result:
-- O-Level : best 7 subjects (lowest points = best)
-- A-Level : best 3 COMPULSORY subjects (non-ELECTIVE)
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
  v_principal_points   INTEGER[] := '{}';
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
      COALESCE(m.marks_obtained, 0)  AS marks_obtained,
      COALESCE(m.practical_marks, 0) AS practical_marks,
      sub.level                      AS sub_level,
      sub.has_practical,
      sub.subject_type,
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
      ORDER BY g.min_mark DESC
      LIMIT 1;
      v_points := COALESCE(v_points, 0);
      v_all_points := array_append(v_all_points, v_points);

      -- A-Level: collect COMPULSORY (non-ELECTIVE) subject points separately
      IF COALESCE(v_level, 'O_LEVEL') = 'A_LEVEL' AND rec.subject_type != 'ELECTIVE' THEN
        v_principal_points := array_append(v_principal_points, v_points);
      END IF;
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
  ORDER BY g.min_mark DESC
  LIMIT 1;
  IF v_grade IS NULL THEN v_grade := 'F'; END IF;

  IF COALESCE(v_level, 'O_LEVEL') = 'O_LEVEL' THEN
    -- Best 7 subjects (lowest points = best grades)
    IF array_length(v_all_points, 1) IS NOT NULL THEN
      SELECT COALESCE(SUM(p), 0) INTO v_points_sum
      FROM (SELECT unnest(v_all_points) AS p ORDER BY p ASC LIMIT v_best_count) best;
    END IF;
    v_division := calculate_o_level_division(v_points_sum);
  ELSE
    -- Best 3 COMPULSORY/principal subjects (lowest points = best)
    IF array_length(v_principal_points, 1) IS NOT NULL THEN
      SELECT COALESCE(SUM(p), 0) INTO v_points_sum
      FROM (SELECT unnest(v_principal_points) AS p ORDER BY p ASC LIMIT 3) best;
    ELSE
      v_points_sum := 0;
    END IF;
    v_division := calculate_a_level_division(v_points_sum);
  END IF;

  IF v_division IS NULL THEN v_division := '0'; END IF;

  INSERT INTO student_results (student_id, exam_id, total_marks, average_marks, grade, division)
  VALUES (p_student_id, p_exam_id, v_raw_total, v_average, v_grade, v_division)
  ON CONFLICT (student_id, exam_id)
  DO UPDATE SET
    total_marks   = EXCLUDED.total_marks,
    average_marks = EXCLUDED.average_marks,
    grade         = EXCLUDED.grade,
    division      = EXCLUDED.division,
    updated_at    = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Strip legacy 'Division ' prefix from any existing stored values
UPDATE student_results
SET division = REPLACE(division, 'Division ', '')
WHERE division LIKE 'Division %';

-- Reprocess all exams so every student gets recalculated with correct logic
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM exams LOOP
    PERFORM process_exam(r.id);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
