-- academic_years.is_locked is referenced by the app (teacher Enter Marks exam
-- query and the Academic Years lock/unlock toggle) but was never added to the
-- schema, so both features silently failed (PostgREST 400: column does not exist).
ALTER TABLE public.academic_years
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;
