-- ============================================================
-- KIZAGA RMS: Migrate old admission numbers to YYYYKNNN format
-- Converts 'FORM1/A/001' → '2025K001', 'FORM1/A/002' → '2025K002', etc.
-- Skips students whose admission_number already matches YYYYKNNN
-- Idempotent — safe to run multiple times
-- ============================================================

-- Step 1: Add temp column to hold new admission numbers
ALTER TABLE students ADD COLUMN IF NOT EXISTS new_admission_number TEXT;

-- Step 2: Generate new admission numbers for old-format entries
-- Uses row_number() over students sorted by class sort_order, stream, surname
DO $$
DECLARE
  v_rec RECORD;
  v_year TEXT := '2025';
  v_prefix TEXT;
  v_seq INTEGER;
  v_new_adm TEXT;
BEGIN
  v_prefix := v_year || 'K';

  -- Find max existing sequence for this year
  SELECT COALESCE(MAX(NULLIF(regexp_replace(admission_number, '^\d{4}K', '', 'g'), '')::INTEGER), 0)
  INTO v_seq
  FROM students
  WHERE admission_number ~ '^\d{4}K\d{3}$';

  FOR v_rec IN
    SELECT s.id, s.admission_number
    FROM students s
    WHERE s.admission_number !~ '^\d{4}K\d{3}$'
      AND s.new_admission_number IS NULL
    ORDER BY s.admission_number
  LOOP
    v_seq := v_seq + 1;
    v_new_adm := v_prefix || LPAD(v_seq::TEXT, 3, '0');

    -- Handle duplicates just in case
    WHILE EXISTS (SELECT 1 FROM students WHERE admission_number = v_new_adm OR new_admission_number = v_new_adm) LOOP
      v_seq := v_seq + 1;
      v_new_adm := v_prefix || LPAD(v_seq::TEXT, 3, '0');
    END LOOP;

    UPDATE students s
    SET new_admission_number = v_new_adm
    WHERE s.id = v_rec.id;
  END LOOP;
END $$;

-- Step 3: Apply the new admission numbers (swap temp → real)
-- First, clear any new-format numbers from the new_admission_number column (they were set to their own value)
UPDATE students
SET new_admission_number = NULL
WHERE admission_number ~ '^\d{4}K\d{3}$';

-- Now update the real column with the temp value
UPDATE students
SET admission_number = new_admission_number
WHERE new_admission_number IS NOT NULL;

-- Step 4: Clean up
ALTER TABLE students DROP COLUMN IF EXISTS new_admission_number;

-- Step 5: Verify
DO $$
DECLARE
  v_old INTEGER;
  v_new INTEGER;
  v_total INTEGER;
BEGIN
  SELECT count(*) INTO v_total FROM students;
  SELECT count(*) INTO v_old FROM students WHERE NOT admission_number ~ '^\d{4}K\d{3}$';
  SELECT count(*) INTO v_new FROM students WHERE admission_number ~ '^\d{4}K\d{3}$';
  RAISE NOTICE 'Total: %, Old format: %, New format: %', v_total, v_old, v_new;
END $$;
