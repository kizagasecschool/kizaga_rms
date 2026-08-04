-- Trigger: when a teacher is assigned to ANY stream of an O-Level class for a subject,
-- automatically assign them to ALL streams of that class for that subject.
-- This enforces the rule: "assigned to a stream = assigned to the whole class."

CREATE OR REPLACE FUNCTION auto_expand_olevel_teacher_subjects()
RETURNS TRIGGER AS $$
DECLARE
  v_class_id uuid;
  v_class_level text;
BEGIN
  -- Get the class and its level from the inserted stream
  SELECT cs.class_id, c.level
  INTO v_class_id, v_class_level
  FROM class_streams cs
  JOIN classes c ON c.id = cs.class_id
  WHERE cs.id = NEW.class_stream_id;

  -- Only expand for O-Level classes (A-Level streams each have different combinations)
  IF v_class_level = 'A_LEVEL' OR v_class_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insert rows for all other streams of this class (safe: ON CONFLICT DO NOTHING)
  INSERT INTO teacher_subjects (teacher_id, class_stream_id, subject_id)
  SELECT NEW.teacher_id, cs.id, NEW.subject_id
  FROM class_streams cs
  WHERE cs.class_id = v_class_id
    AND cs.id != NEW.class_stream_id
  ON CONFLICT (teacher_id, class_stream_id, subject_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists so this migration is safe to re-run
DROP TRIGGER IF EXISTS trg_expand_olevel_teacher_subjects ON teacher_subjects;

CREATE TRIGGER trg_expand_olevel_teacher_subjects
AFTER INSERT ON teacher_subjects
FOR EACH ROW
EXECUTE FUNCTION auto_expand_olevel_teacher_subjects();
