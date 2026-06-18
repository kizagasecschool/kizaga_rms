-- ============================================================
-- FIX: Allow public/anonymous users to read school_settings
-- Login, Landing, and ForgotPassword pages need this before
-- the user is authenticated to display the school logo.
-- ============================================================

DROP POLICY IF EXISTS "public_read_school_settings" ON school_settings;
CREATE POLICY "public_read_school_settings" ON school_settings
  FOR SELECT USING (true);
