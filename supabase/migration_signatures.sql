-- Add signature_url to teachers table
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS signature_url TEXT;

-- Add signature URLs to school_settings
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS headmaster_signature_url TEXT;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS deputy_signature_url TEXT;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS academic_signature_url TEXT;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS mhuri_url TEXT;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS signature_sizes JSONB DEFAULT '{}';

-- Create signatures storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for signatures bucket
CREATE POLICY "public_select_signatures" ON storage.objects
  FOR SELECT USING (bucket_id = 'signatures');

CREATE POLICY "admin_insert_signatures" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'signatures'
    AND (SELECT get_my_role()) IN ('admin', 'headmaster')
  );

CREATE POLICY "admin_update_signatures" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'signatures'
    AND (SELECT get_my_role()) IN ('admin', 'headmaster')
  );

CREATE POLICY "admin_delete_signatures" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'signatures'
    AND (SELECT get_my_role()) IN ('admin', 'headmaster')
  );
