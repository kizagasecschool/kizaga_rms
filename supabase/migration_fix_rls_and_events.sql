-- ============================================================
-- 1. Create events_announcements table (was never applied)
-- ============================================================
CREATE TABLE IF NOT EXISTS events_announcements (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type       TEXT NOT NULL CHECK (type IN ('EVENT', 'ANNOUNCEMENT')),
  title      TEXT NOT NULL,
  description TEXT DEFAULT '',
  file_url   TEXT DEFAULT '',
  file_type  TEXT DEFAULT '' CHECK (file_type IN ('', 'image', 'pdf')),
  event_date DATE DEFAULT NULL,
  is_active  BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE events_announcements ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_events_announcements_updated_at ON events_announcements;
CREATE TRIGGER trg_events_announcements_updated_at
  BEFORE UPDATE ON events_announcements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 2. Fix events_announcements policies (use get_my_role())
-- ============================================================
DROP POLICY IF EXISTS "public_select_events_announcements" ON events_announcements;
CREATE POLICY "public_select_events_announcements"
  ON events_announcements FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "public_auth_select_events_announcements" ON events_announcements;
CREATE POLICY "public_auth_select_events_announcements"
  ON events_announcements FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_headmaster_all_events_announcements" ON events_announcements;
CREATE POLICY "admin_headmaster_all_events_announcements"
  ON events_announcements FOR ALL TO authenticated
  USING     (get_my_role() IN ('admin', 'headmaster'))
  WITH CHECK(get_my_role() IN ('admin', 'headmaster'));

-- ============================================================
-- 3. Fix joining_instructions policies (use get_my_role())
-- ============================================================
DROP POLICY IF EXISTS "admin_headmaster_all_joining_instructions" ON joining_instructions;
CREATE POLICY "admin_headmaster_all_joining_instructions"
  ON joining_instructions FOR ALL TO authenticated
  USING     (get_my_role() IN ('admin', 'headmaster'))
  WITH CHECK(get_my_role() IN ('admin', 'headmaster'));

-- ============================================================
-- 4. Fix uniforms policies (use get_my_role())
-- ============================================================
DROP POLICY IF EXISTS "admin_headmaster_all_uniforms" ON uniforms;
CREATE POLICY "admin_headmaster_all_uniforms"
  ON uniforms FOR ALL TO authenticated
  USING     (get_my_role() IN ('admin', 'headmaster'))
  WITH CHECK(get_my_role() IN ('admin', 'headmaster'));

-- ============================================================
-- 5. Fix school_settings: add explicit WITH CHECK
-- ============================================================
DROP POLICY IF EXISTS "admin_headmaster_all_school_settings" ON school_settings;
CREATE POLICY "admin_headmaster_all_school_settings"
  ON school_settings FOR ALL
  USING     (get_my_role() IN ('admin', 'headmaster'))
  WITH CHECK(get_my_role() IN ('admin', 'headmaster'));

-- ============================================================
-- 6. Storage bucket for events-media
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'events-media', 'events-media', true, 10485760,
  ARRAY['image/png','image/jpeg','image/webp','image/gif','application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Fix storage policies to use get_my_role() instead of EXISTS subquery
DROP POLICY IF EXISTS "public_select_events_media"            ON storage.objects;
DROP POLICY IF EXISTS "admin_headmaster_insert_events_media"  ON storage.objects;
DROP POLICY IF EXISTS "admin_headmaster_update_events_media"  ON storage.objects;
DROP POLICY IF EXISTS "admin_headmaster_delete_events_media"  ON storage.objects;

CREATE POLICY "public_select_events_media"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'events-media');

CREATE POLICY "admin_headmaster_insert_events_media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'events-media' AND get_my_role() IN ('admin', 'headmaster'));

CREATE POLICY "admin_headmaster_update_events_media"
  ON storage.objects FOR UPDATE TO authenticated
  USING     (bucket_id = 'events-media' AND get_my_role() IN ('admin', 'headmaster'))
  WITH CHECK(bucket_id = 'events-media' AND get_my_role() IN ('admin', 'headmaster'));

CREATE POLICY "admin_headmaster_delete_events_media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'events-media' AND get_my_role() IN ('admin', 'headmaster'));

-- ============================================================
-- Verify
-- ============================================================
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('events_announcements','joining_instructions','uniforms','school_settings')
ORDER BY tablename, cmd;
