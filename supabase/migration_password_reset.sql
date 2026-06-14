-- ============================================================
-- Migration: Password reset tokens table
-- Stores tokens sent via Resend API for password recovery
-- ============================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email      TEXT NOT NULL,
  token      TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON password_reset_tokens(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
