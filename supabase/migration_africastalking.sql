ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS at_api_key  TEXT;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS at_username TEXT;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS at_sender_id TEXT;
