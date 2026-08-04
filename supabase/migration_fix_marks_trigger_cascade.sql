-- Fix: trg_check_exam_status was blocking the SET NULL cascade on marks.entered_by
-- when deleting a user/profile while exams are in processed status.
-- Allow updates that only null out the entered_by attribution column;
-- only enforce the exam-status check when actual mark values change.

CREATE OR REPLACE FUNCTION trg_check_exam_status()
RETURNS TRIGGER AS $$
DECLARE
  v_status TEXT;
BEGIN
  -- Allow updates that only change entered_by (SET NULL cascade from user deletion).
  -- Actual mark data (exam, student, subject, scores, absence) must be unchanged.
  IF (TG_OP = 'UPDATE'
      AND NEW.exam_id       = OLD.exam_id
      AND NEW.student_id    = OLD.student_id
      AND NEW.subject_id    = OLD.subject_id
      AND (NEW.marks_obtained   IS NOT DISTINCT FROM OLD.marks_obtained)
      AND (NEW.practical_marks  IS NOT DISTINCT FROM OLD.practical_marks)
      AND (NEW.is_absent        IS NOT DISTINCT FROM OLD.is_absent)
  ) THEN
    RETURN NEW;
  END IF;

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
