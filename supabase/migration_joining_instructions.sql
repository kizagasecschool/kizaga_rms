-- Joining Instructions management
-- Stores PDF files for O-Level and A-Level joining instructions

CREATE TABLE IF NOT EXISTS joining_instructions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  level TEXT NOT NULL CHECK (level IN ('O_LEVEL', 'A_LEVEL')),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  pdf_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(level)
);

ALTER TABLE joining_instructions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_joining_instructions" ON joining_instructions;
CREATE POLICY "public_select_joining_instructions"
  ON joining_instructions FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "admin_headmaster_all_joining_instructions" ON joining_instructions;
CREATE POLICY "admin_headmaster_all_joining_instructions"
  ON joining_instructions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'headmaster')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'headmaster')
    )
  );

DROP TRIGGER IF EXISTS trg_joining_instructions_updated_at ON joining_instructions;
CREATE TRIGGER trg_joining_instructions_updated_at
  BEFORE UPDATE ON joining_instructions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Storage bucket for joining instruction PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'joining-instructions-pdfs',
  'joining-instructions-pdfs',
  true,
  10485760,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
DROP POLICY IF EXISTS "public_select_joining_instructions_pdfs" ON storage.objects;
CREATE POLICY "public_select_joining_instructions_pdfs"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'joining-instructions-pdfs');

DROP POLICY IF EXISTS "admin_headmaster_insert_joining_instructions_pdfs" ON storage.objects;
CREATE POLICY "admin_headmaster_insert_joining_instructions_pdfs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'joining-instructions-pdfs'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'headmaster')
    )
  );

DROP POLICY IF EXISTS "admin_headmaster_update_joining_instructions_pdfs" ON storage.objects;
CREATE POLICY "admin_headmaster_update_joining_instructions_pdfs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'joining-instructions-pdfs'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'headmaster')
    )
  )
  WITH CHECK (
    bucket_id = 'joining-instructions-pdfs'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'headmaster')
    )
  );

DROP POLICY IF EXISTS "admin_headmaster_delete_joining_instructions_pdfs" ON storage.objects;
CREATE POLICY "admin_headmaster_delete_joining_instructions_pdfs"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'joining-instructions-pdfs'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'headmaster')
    )
  );
