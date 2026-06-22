-- Fix corrupted JSONB items in uniforms table
-- Some records may have items stored as a JSONB string instead of array.
DO $$
DECLARE
  rec RECORD;
  parsed jsonb;
BEGIN
  -- Convert null to empty array
  UPDATE uniforms SET items = '[]'::jsonb WHERE items IS NULL;

  -- Process string-typed items
  FOR rec IN SELECT id, items FROM uniforms WHERE jsonb_typeof(items) = 'string' LOOP
    BEGIN
      parsed := (rec.items #>> '{}')::jsonb;
      UPDATE uniforms SET items = parsed WHERE id = rec.id;
    EXCEPTION WHEN OTHERS THEN
      -- Not valid JSON, wrap in array
      UPDATE uniforms SET items = to_jsonb(ARRAY[rec.items #>> '{}']) WHERE id = rec.id;
    END;
  END LOOP;
END;
$$;
