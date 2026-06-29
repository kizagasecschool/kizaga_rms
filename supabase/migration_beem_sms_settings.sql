-- Migrate SMS provider from Africa's Talking to Beem Africa
ALTER TABLE school_settings
  ADD COLUMN IF NOT EXISTS beem_api_key    TEXT,
  ADD COLUMN IF NOT EXISTS beem_secret_key TEXT,
  ADD COLUMN IF NOT EXISTS beem_sender_id  TEXT;

-- Old Africa's Talking columns can be dropped once Beem is confirmed working:
-- ALTER TABLE school_settings
--   DROP COLUMN IF EXISTS at_api_key,
--   DROP COLUMN IF EXISTS at_username,
--   DROP COLUMN IF EXISTS at_sender_id;
