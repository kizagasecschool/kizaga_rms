-- O-Level students should not have a specific stream — they belong to the whole class.
-- Step 1: backfill class_id for any O-Level student that somehow has stream but no class_id
UPDATE students s
SET class_id = cs.class_id
FROM class_streams cs
JOIN classes c ON c.id = cs.class_id
WHERE s.class_stream_id = cs.id
  AND c.level = 'O_LEVEL'
  AND s.class_id IS NULL;

-- Step 2: clear class_stream_id for O-Level students
UPDATE students s
SET class_stream_id = NULL
FROM class_streams cs
JOIN classes c ON c.id = cs.class_id
WHERE s.class_stream_id = cs.id
  AND c.level = 'O_LEVEL';
