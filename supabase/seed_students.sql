-- ============================================================
-- KIZAGA RMS: Seed 10 students per class-stream
-- Idempotent — safe to run multiple times
-- Run this AFTER migration_tables.sql (classes, streams exist)
-- Generates 30 class_streams × 10 students = 300 students
-- ============================================================

-- ============================================================
-- 1. Ensure all class_streams exist (Form 1–6 × Streams A–E)
-- ============================================================
INSERT INTO class_streams (class_id, stream_id)
SELECT c.id, s.id
FROM classes c
CROSS JOIN streams s
WHERE NOT EXISTS (
  SELECT 1 FROM class_streams cs
  WHERE cs.class_id = c.id AND cs.stream_id = s.id
);

-- ============================================================
-- 2. Students per class_stream (10 each)
-- ============================================================

-- Helper function to generate admission number
CREATE OR REPLACE FUNCTION generate_admission_number(p_class TEXT, p_stream TEXT, p_seq INTEGER)
RETURNS TEXT AS $$
BEGIN
  RETURN upper(translate(p_class, ' ', '')) || '/' || p_stream || '/' || LPAD(p_seq::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper function to assign gender deterministically from sequence number
CREATE OR REPLACE FUNCTION assign_gender(p_seq INTEGER)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE WHEN p_seq % 2 = 0 THEN 'Female' ELSE 'Male' END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Students per class/stream (10 per class_stream)
DO $$
DECLARE
  v_class RECORD;
  v_stream RECORD;
  v_csid UUID;
  v_seq INTEGER;
  v_first TEXT;
  v_middle TEXT;
  v_surname TEXT;
  v_gender TEXT;
  v_dob DATE;
  v_adm TEXT;
  v_adm_date DATE := '2025-01-15'::DATE;
  v_parent TEXT;
  v_phone TEXT;
BEGIN
  FOR v_class IN SELECT * FROM classes ORDER BY sort_order LOOP
    FOR v_stream IN SELECT * FROM streams ORDER BY stream_name LOOP
      -- Get class_stream id
      SELECT id INTO v_csid
      FROM class_streams
      WHERE class_id = v_class.id AND stream_id = v_stream.id;

      -- Check if this class_stream already has 10 students
      IF (SELECT count(*) FROM students WHERE class_stream_id = v_csid) >= 10 THEN
        CONTINUE;
      END IF;

      -- Determine how many more students we need
      FOR v_seq IN 1..10 LOOP
        -- Skip if student already exists for this slot
        v_adm := generate_admission_number(v_class.class_name, v_stream.stream_name, v_seq);
        IF EXISTS (SELECT 1 FROM students WHERE admission_number = v_adm) THEN
          CONTINUE;
        END IF;

        -- Generate names based on sequence
        v_gender := assign_gender(v_seq);
        v_dob := ('2006-01-01'::DATE + (v_seq * 30)::INTEGER + (v_class.sort_order * 60)::INTEGER);

        -- Tanzanian names array
        IF v_gender = 'Male' THEN
          v_first := (ARRAY[
            'Juma', 'Baraka', 'Emmanuel', 'Daniel', 'Peter',
            'Joseph', 'David', 'Michael', 'John', 'Yohana'
          ])[v_seq];
          v_middle := (ARRAY[
            'Abdallah', 'Samwel', 'Charles', 'Amos', 'Patrick',
            'Gabriel', 'Mathias', 'William', 'Richard', 'Filipo'
          ])[v_seq];
          v_surname := (ARRAY[
            'Mushi', 'Mwenda', 'Kiswili', 'Nchimbi', 'Mollel',
            'Mrema', 'Shayo', 'Mboya', 'Lema', 'Mkude'
          ])[v_seq];
        ELSE
          v_first := (ARRAY[
            'Aisha', 'Mariam', 'Neema', 'Grace', 'Hawa',
            'Asha', 'Anna', 'Esther', 'Rehema', 'Zainabu'
          ])[v_seq];
          v_middle := (ARRAY[
            'Salum', 'Hassan', 'Abdallah', 'Hamis', 'Said',
            'Juma', 'Omary', 'Rashid', 'Bakar', 'Swalehe'
          ])[v_seq];
          v_surname := (ARRAY[
            'Mushi', 'Mwenda', 'Kiswili', 'Nchimbi', 'Mollel',
            'Mrema', 'Shayo', 'Mboya', 'Lema', 'Mkude'
          ])[v_seq];
        END IF;

        v_parent := (ARRAY[
          'Abdallah ' || v_surname, 'Samwel ' || v_surname, 'Charles ' || v_surname,
          'Joseph ' || v_surname, 'Patrick ' || v_surname, 'Peter ' || v_surname,
          'Michael ' || v_surname, 'John ' || v_surname, 'David ' || v_surname,
          'William ' || v_surname
        ])[v_seq];

        v_phone := '+255' || (700 + v_class.sort_order)::TEXT || LPAD(v_seq::TEXT, 6, '0');

        INSERT INTO students (
          admission_number, first_name, middle_name, surname,
          gender, date_of_birth, class_stream_id, admission_date,
          status, parent_name, parent_phone, address
        ) VALUES (
          v_adm,
          v_first,
          v_middle,
          v_surname,
          v_gender,
          v_dob,
          v_csid,
          v_adm_date,
          'active',
          v_parent,
          v_phone,
          'P.O. Box ' || (100 + v_seq)::TEXT || ', Moshi'
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- Verify
-- ============================================================
DO $$
DECLARE
  v_total INTEGER;
BEGIN
  SELECT count(*) INTO v_total FROM students;
  RAISE NOTICE 'Total students seeded: %', v_total;
END $$;
