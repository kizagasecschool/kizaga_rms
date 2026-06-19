-- Create admission_applications table for public student admission requests

CREATE TABLE IF NOT EXISTS admission_applications (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_no   TEXT NOT NULL UNIQUE,
  first_name       TEXT NOT NULL,
  middle_name      TEXT DEFAULT '',
  surname          TEXT NOT NULL,
  gender           TEXT CHECK (gender IN ('Male', 'Female')),
  date_of_birth    DATE,
  class_applying   TEXT NOT NULL,
  previous_school  TEXT DEFAULT '',
  disability       TEXT DEFAULT '',
  exam_no          TEXT DEFAULT '',
  region           TEXT DEFAULT '',
  district         TEXT DEFAULT '',
  reasons          TEXT DEFAULT '',
  parent_name      TEXT NOT NULL,
  parent_phone     TEXT NOT NULL,
  parent_email     TEXT DEFAULT '',
  address          TEXT DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'needs_info', 'withdrawn')),
  admin_notes      TEXT DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add columns if table already exists (safe migration)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admission_applications' AND column_name = 'exam_no') THEN
    ALTER TABLE admission_applications ADD COLUMN exam_no TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admission_applications' AND column_name = 'region') THEN
    ALTER TABLE admission_applications ADD COLUMN region TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admission_applications' AND column_name = 'district') THEN
    ALTER TABLE admission_applications ADD COLUMN district TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admission_applications' AND column_name = 'reasons') THEN
    ALTER TABLE admission_applications ADD COLUMN reasons TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admission_applications' AND column_name = 'disability') THEN
    ALTER TABLE admission_applications ADD COLUMN disability TEXT DEFAULT '';
  END IF;
END $$;

-- Enable RLS
ALTER TABLE admission_applications ENABLE ROW LEVEL SECURITY;

-- Public can insert (for admission form)
DROP POLICY IF EXISTS "public_insert_admission_applications" ON admission_applications;
CREATE POLICY "public_insert_admission_applications"
  ON admission_applications
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Public can select own application by application_no
DROP POLICY IF EXISTS "public_select_own_application" ON admission_applications;
CREATE POLICY "public_select_own_application"
  ON admission_applications
  FOR SELECT
  TO anon
  USING (true);

-- Admin, headmaster, and academic can see all and update
DROP POLICY IF EXISTS "admin_headmaster_academic_all_admission_applications" ON admission_applications;
CREATE POLICY "admin_headmaster_academic_all_admission_applications"
  ON admission_applications
  FOR ALL
  TO authenticated
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'headmaster', 'academic')
    )
  )
  WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'headmaster', 'academic')
    )
  );

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trg_admission_applications_updated_at ON admission_applications;
CREATE TRIGGER trg_admission_applications_updated_at
  BEFORE UPDATE ON admission_applications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RPC function for admin/headmaster/academic to list all applications (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION get_admission_applications()
RETURNS SETOF admission_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'headmaster', 'academic')
  ) THEN
    RETURN QUERY SELECT * FROM admission_applications ORDER BY created_at DESC;
  END IF;
END;
$$;

-- RPC function to update application status (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION update_admission_application(
  app_id UUID,
  new_status TEXT,
  notes TEXT DEFAULT NULL
)
RETURNS admission_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result admission_applications;
BEGIN
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'headmaster', 'academic')
  ) THEN
    UPDATE admission_applications
    SET status = new_status,
        admin_notes = COALESCE(notes, admin_notes),
        updated_at = NOW()
    WHERE id = app_id
    RETURNING * INTO result;
    RETURN result;
  END IF;
  RAISE EXCEPTION 'Unauthorized';
END;
$$;
