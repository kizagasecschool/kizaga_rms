-- ============================================================
-- FIX: Ranking per class_id (instead of class_stream_id)
-- Positions are now unique per CLASS, not per stream.
-- If a class has Stream A and B, there is one #1, one #2, etc.
-- ============================================================

CREATE OR REPLACE FUNCTION update_class_rankings(p_exam_id UUID)
RETURNS VOID AS $$
BEGIN
  WITH ranked AS (
    SELECT
      sr.id,
      s.class_id,
      RANK() OVER (
        PARTITION BY COALESCE(s.class_id, cs.class_id)
        ORDER BY sr.average_marks DESC
      ) AS pos
    FROM student_results sr
    JOIN students s ON s.id = sr.student_id
    LEFT JOIN class_streams cs ON cs.id = s.class_stream_id
    WHERE sr.exam_id = p_exam_id
  )
  UPDATE student_results sr
  SET position = ranked.pos
  FROM ranked
  WHERE sr.id = ranked.id;
END;
$$ LANGUAGE plpgsql;

NOTIFY pgrst, 'reload schema';
