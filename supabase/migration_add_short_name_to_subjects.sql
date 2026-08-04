-- Add short_name column to subjects table (NECTA display code)
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS short_name TEXT;
