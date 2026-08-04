-- Conversation table for admission applicant ↔ academic communication
CREATE TABLE IF NOT EXISTS application_conversations (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id      UUID NOT NULL REFERENCES admission_applications(id) ON DELETE CASCADE,
  sender              TEXT NOT NULL CHECK (sender IN ('academic', 'applicant')),
  message             TEXT NOT NULL DEFAULT '',
  requires_attachment BOOLEAN NOT NULL DEFAULT false,
  attachment_url      TEXT DEFAULT '',
  is_read             BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_conversations_app_id
  ON application_conversations(application_id);

-- RLS
ALTER TABLE application_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_app_conversations" ON application_conversations;
CREATE POLICY "public_select_app_conversations"
  ON application_conversations FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "academic_insert_app_conversations" ON application_conversations;
CREATE POLICY "academic_insert_app_conversations"
  ON application_conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    sender = 'academic'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'headmaster', 'academic')
    )
  );

DROP POLICY IF EXISTS "applicant_insert_app_conversations" ON application_conversations;
CREATE POLICY "applicant_insert_app_conversations"
  ON application_conversations FOR INSERT
  TO anon
  WITH CHECK (sender = 'applicant');

-- Storage bucket for admission attachments (PDF files)
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
SELECT 'application-files', 'application-files', TRUE, FALSE, 10485760, ARRAY['application/pdf']
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'application-files');

DROP POLICY IF EXISTS "public_select_app_files" ON storage.objects;
CREATE POLICY "public_select_app_files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'application-files');

DROP POLICY IF EXISTS "public_insert_app_files" ON storage.objects;
CREATE POLICY "public_insert_app_files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'application-files');

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trg_app_conversations_updated_at ON application_conversations;
CREATE TRIGGER trg_app_conversations_updated_at
  BEFORE UPDATE ON application_conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RPC: Academic sends a request for more info
CREATE OR REPLACE FUNCTION send_application_request(
  p_application_id UUID,
  p_message TEXT,
  p_requires_attachment BOOLEAN DEFAULT false
)
RETURNS application_conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result application_conversations;
BEGIN
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'headmaster', 'academic')
  ) THEN
    INSERT INTO application_conversations (application_id, sender, message, requires_attachment)
    VALUES (p_application_id, 'academic', p_message, p_requires_attachment)
    RETURNING * INTO result;

    UPDATE admission_applications
    SET status = 'needs_info',
        admin_notes = p_message,
        updated_at = NOW()
    WHERE id = p_application_id;

    RETURN result;
  END IF;
  RAISE EXCEPTION 'Unauthorized';
END;
$$;

-- RPC: Applicant sends a reply (public, no auth check)
CREATE OR REPLACE FUNCTION send_application_reply(
  p_application_id UUID,
  p_message TEXT DEFAULT '',
  p_attachment_url TEXT DEFAULT ''
)
RETURNS application_conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result application_conversations;
BEGIN
  INSERT INTO application_conversations (application_id, sender, message, attachment_url)
  VALUES (p_application_id, 'applicant', p_message, p_attachment_url)
  RETURNING * INTO result;

  UPDATE admission_applications
  SET status = 'pending',
      updated_at = NOW()
  WHERE id = p_application_id;

  RETURN result;
END;
$$;

-- RPC: Fetch conversations for an application
CREATE OR REPLACE FUNCTION get_application_conversations(p_application_id UUID)
RETURNS SETOF application_conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM application_conversations
  WHERE application_id = p_application_id
  ORDER BY created_at ASC;
END;
$$;

-- RPC: Delete an admission application (admin/headmaster/academic only)
CREATE OR REPLACE FUNCTION delete_admission_application(p_application_id UUID)
RETURNS void
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
    DELETE FROM admission_applications WHERE id = p_application_id;
    RETURN;
  END IF;
  RAISE EXCEPTION 'Unauthorized';
END;
$$;

-- RPC: Convert an approved application into a student record
CREATE OR REPLACE FUNCTION convert_application_to_student(
  p_application_id UUID,
  p_class_stream_id UUID,
  p_admission_number TEXT
)
RETURNS students
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app admission_applications;
  result students;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'headmaster', 'academic')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO app FROM admission_applications WHERE id = p_application_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  IF app.status != 'approved' THEN
    RAISE EXCEPTION 'Application must be approved first';
  END IF;

  INSERT INTO students (
    admission_number, first_name, middle_name, surname,
    gender, date_of_birth, class_stream_id, admission_date,
    status, parent_name, parent_phone, address
  ) VALUES (
    p_admission_number, app.first_name, app.middle_name, app.surname,
    app.gender, app.date_of_birth, p_class_stream_id, CURRENT_DATE,
    'active', app.parent_name, app.parent_phone, app.address
  ) RETURNING * INTO result;

  DELETE FROM admission_applications WHERE id = p_application_id;

  RETURN result;
END;
$$;
