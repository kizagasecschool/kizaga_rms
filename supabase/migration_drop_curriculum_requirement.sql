-- Drop the NOT NULL constraint on curriculum_id in combinations table.
-- This allows creating combinations without a curriculum.
ALTER TABLE public.combinations ALTER COLUMN curriculum_id DROP NOT NULL;
