-- ============================================================
-- KIZAGA RMS: Seed Form 1 students (30 — 15 Male, 15 Female)
-- Idempotent — safe to run multiple times
-- Run AFTER migration_tables.sql (classes, streams exist)
-- ============================================================

-- Ensure class_stream exists for Form 1 / Stream A
INSERT INTO class_streams (class_id, stream_id)
SELECT c.id, s.id
FROM classes c, streams s
WHERE c.class_name = 'Form 1' AND s.stream_name = 'A'
  AND NOT EXISTS (
    SELECT 1 FROM class_streams cs
    WHERE cs.class_id = c.id AND cs.stream_id = s.id
  );

-- Insert Form 1 students
DO $$
DECLARE
  v_csid UUID;
  v_adm TEXT;
  v_seq INTEGER;
  v_global_seq INTEGER;
  v_first TEXT;
  v_middle TEXT;
  v_surname TEXT;
  v_gender TEXT;
  v_dob DATE;
  v_parent TEXT;
  v_phone TEXT;
  v_adm_date DATE := '2025-01-15'::DATE;
  v_year TEXT := '2025';
  v_prefix TEXT;
BEGIN
  v_prefix := v_year || 'K';

  -- Find max existing sequence for this year
  SELECT COALESCE(MAX(NULLIF(regexp_replace(admission_number, '^\d{4}K', '', 'g'), '')::INTEGER), 0)
  INTO v_global_seq
  FROM students
  WHERE admission_number ~ '^\d{4}K\d{3}$';

  -- Get Form 1 / Stream A class_stream id
  SELECT cs.id INTO v_csid
  FROM class_streams cs
  JOIN classes c ON c.id = cs.class_id
  JOIN streams s ON s.id = cs.stream_id
  WHERE c.class_name = 'Form 1' AND s.stream_name = 'A';

  -- ========================================
  -- Wanafunzi wa Kiume (15) — seq 1–15
  -- ========================================
  FOR v_seq IN 1..15 LOOP
    v_global_seq := v_global_seq + 1;
    v_adm := v_prefix || LPAD(v_global_seq::TEXT, 3, '0');

    IF NOT EXISTS (SELECT 1 FROM students WHERE admission_number = v_adm) THEN
      CASE v_seq
        WHEN 1  THEN v_first := 'Juma';     v_middle := 'Hassan';    v_surname := 'Mwambene';
        WHEN 2  THEN v_first := 'Daudi';    v_middle := 'Peter';     v_surname := 'Massawe';
        WHEN 3  THEN v_first := 'Said';     v_middle := 'Omari';     v_surname := 'Kiwelu';
        WHEN 4  THEN v_first := 'Yusuf';    v_middle := 'Ramadhani'; v_surname := 'Chuma';
        WHEN 5  THEN v_first := 'Emmanuel'; v_middle := 'John';      v_surname := 'Mtui';
        WHEN 6  THEN v_first := 'Hamisi';   v_middle := 'Athumani';  v_surname := 'Lyimo';
        WHEN 7  THEN v_first := 'Goodluck'; v_middle := 'Joseph';    v_surname := 'Mwakasege';
        WHEN 8  THEN v_first := 'Ibrahimu'; v_middle := 'Salum';     v_surname := 'Ngowi';
        WHEN 9  THEN v_first := 'Frank';    v_middle := 'Charles';   v_surname := 'Mbwambo';
        WHEN 10 THEN v_first := 'Abdallah'; v_middle := 'Rashidi';   v_surname := 'Sumari';
        WHEN 11 THEN v_first := 'Bahati';   v_middle := 'Method';    v_surname := 'Kessy';
        WHEN 12 THEN v_first := 'Mussa';    v_middle := 'Iddi';      v_surname := 'Nyangoma';
        WHEN 13 THEN v_first := 'Erick';    v_middle := 'Anthony';   v_surname := 'Lema';
        WHEN 14 THEN v_first := 'Shabani';  v_middle := 'Mussa';     v_surname := 'Kindole';
        WHEN 15 THEN v_first := 'Patrick';  v_middle := 'Edward';    v_surname := 'Mbise';
      END CASE;

      v_gender := 'Male';
      v_dob := ('2008-01-01'::DATE + (v_seq * 15)::INTEGER);
      v_parent := 'Mwanaume ' || v_surname;
      v_phone := '+255712' || LPAD(v_seq::TEXT, 6, '0');

      INSERT INTO students (
        admission_number, first_name, middle_name, surname,
        gender, date_of_birth, class_stream_id, admission_date,
        status, parent_name, parent_phone, address
      ) VALUES (
        v_adm, v_first, v_middle, v_surname,
        v_gender, v_dob, v_csid, v_adm_date,
        'active', v_parent, v_phone,
        'P.O. Box ' || (200 + v_seq)::TEXT || ', Moshi'
      );
    END IF;
  END LOOP;

  -- ========================================
  -- Wanafunzi wa Kike (15) — seq 16–30
  -- ========================================
  FOR v_seq IN 16..30 LOOP
    v_global_seq := v_global_seq + 1;
    v_adm := v_prefix || LPAD(v_global_seq::TEXT, 3, '0');

    IF NOT EXISTS (SELECT 1 FROM students WHERE admission_number = v_adm) THEN
      CASE v_seq
        WHEN 16 THEN v_first := 'Mariam';   v_middle := 'Hassan';    v_surname := 'Mwakalinga';
        WHEN 17 THEN v_first := 'Asha';     v_middle := 'Omari';     v_surname := 'Chami';
        WHEN 18 THEN v_first := 'Neema';    v_middle := 'Joseph';    v_surname := 'Shayo';
        WHEN 19 THEN v_first := 'Fatuma';   v_middle := 'Said';      v_surname := 'Mwakipesile';
        WHEN 20 THEN v_first := 'Grace';    v_middle := 'Daniel';    v_surname := 'Kimaro';
        WHEN 21 THEN v_first := 'Halima';   v_middle := 'Athumani';  v_surname := 'Mwasote';
        WHEN 22 THEN v_first := 'Rehema';   v_middle := 'Ramadhani'; v_surname := 'Mvungi';
        WHEN 23 THEN v_first := 'Salma';    v_middle := 'Iddi';      v_surname := 'Kaaya';
        WHEN 24 THEN v_first := 'Joyce';    v_middle := 'Method';    v_surname := 'Macha';
        WHEN 25 THEN v_first := 'Zainabu';  v_middle := 'Rashidi';   v_surname := 'Mwanjale';
        WHEN 26 THEN v_first := 'Pendo';    v_middle := 'Charles';   v_surname := 'Massaba';
        WHEN 27 THEN v_first := 'Amina';    v_middle := 'Salum';     v_surname := 'Mwakatobe';
        WHEN 28 THEN v_first := 'Esther';   v_middle := 'John';      v_surname := 'Nnko';
        WHEN 29 THEN v_first := 'Khadija';  v_middle := 'Hamisi';    v_surname := 'Lyaruu';
        WHEN 30 THEN v_first := 'Beatrice'; v_middle := 'Edward';    v_surname := 'Sanga';
      END CASE;

      v_gender := 'Female';
      v_dob := ('2008-01-01'::DATE + (v_seq * 15)::INTEGER);
      v_parent := 'Mwanamke ' || v_surname;
      v_phone := '+255713' || LPAD((v_seq - 15)::TEXT, 6, '0');

      INSERT INTO students (
        admission_number, first_name, middle_name, surname,
        gender, date_of_birth, class_stream_id, admission_date,
        status, parent_name, parent_phone, address
      ) VALUES (
        v_adm, v_first, v_middle, v_surname,
        v_gender, v_dob, v_csid, v_adm_date,
        'active', v_parent, v_phone,
        'P.O. Box ' || (200 + v_seq)::TEXT || ', Moshi'
      );
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- Verify
-- ============================================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT count(*) INTO v_count
  FROM students s
  JOIN class_streams cs ON cs.id = s.class_stream_id
  JOIN classes c ON c.id = cs.class_id
  WHERE c.class_name = 'Form 1';

  RAISE NOTICE 'Form 1 students seeded: %', v_count;
END $$;
