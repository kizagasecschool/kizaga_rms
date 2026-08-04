-- ============================================================
-- Add BeemAfrica SMS configuration columns to school_settings
-- ============================================================

ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS beem_api_key    TEXT;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS beem_secret_key TEXT;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS beem_sender_id  TEXT;
