-- Events & Announcements management

CREATE TABLE IF NOT EXISTS events_announcements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('EVENT', 'ANNOUNCEMENT')),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  file_url TEXT DEFAULT '',
  file_type TEXT DEFAULT '' CHECK (file_type IN ('', 'image', 'pdf')),
  event_date DATE DEFAULT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE events_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_events_announcements" ON events_announcements;
CREATE POLICY "public_select_events_announcements"
  ON events_announcements FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "admin_headmaster_all_events_announcements" ON events_announcements;
CREATE POLICY "admin_headmaster_all_events_announcements"
  ON events_announcements FOR ALL TO authenticated
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

DROP TRIGGER IF EXISTS trg_events_announcements_updated_at ON events_announcements;
CREATE TRIGGER trg_events_announcements_updated_at
  BEFORE UPDATE ON events_announcements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Storage bucket for events & announcements media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'events-media',
  'events-media',
  true,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public_select_events_media" ON storage.objects;
CREATE POLICY "public_select_events_media"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'events-media');

DROP POLICY IF EXISTS "admin_headmaster_insert_events_media" ON storage.objects;
CREATE POLICY "admin_headmaster_insert_events_media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'events-media'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'headmaster')
    )
  );

DROP POLICY IF EXISTS "admin_headmaster_update_events_media" ON storage.objects;
CREATE POLICY "admin_headmaster_update_events_media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'events-media'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'headmaster')
    )
  )
  WITH CHECK (
    bucket_id = 'events-media'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'headmaster')
    )
  );

DROP POLICY IF EXISTS "admin_headmaster_delete_events_media" ON storage.objects;
CREATE POLICY "admin_headmaster_delete_events_media"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'events-media'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'headmaster')
    )
  );
