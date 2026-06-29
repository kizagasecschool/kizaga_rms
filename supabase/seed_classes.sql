-- Seed Classes: O-Level (Form 1-4) + A-Level (Form 5-6)
INSERT INTO classes (class_name, level, sort_order)
SELECT v.class_name, v.level, v.sort_order
FROM (VALUES
  ('Form 1', 'O_LEVEL', 1),
  ('Form 2', 'O_LEVEL', 2),
  ('Form 3', 'O_LEVEL', 3),
  ('Form 4', 'O_LEVEL', 4),
  ('Form 5', 'A_LEVEL', 5),
  ('Form 6', 'A_LEVEL', 6)
) AS v(class_name, level, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM classes c WHERE c.class_name = v.class_name);

-- Seed Streams: A-E
INSERT INTO streams (stream_name)
SELECT v.stream_name
FROM (VALUES ('A'), ('B'), ('C'), ('D'), ('E')) AS v(stream_name)
WHERE NOT EXISTS (SELECT 1 FROM streams s WHERE s.stream_name = v.stream_name);

-- Seed Class Streams (Form 1-6 × Streams A-E)
INSERT INTO class_streams (class_id, stream_id)
SELECT c.id, st.id
FROM classes c
CROSS JOIN streams st
WHERE NOT EXISTS (
  SELECT 1 FROM class_streams cs
  WHERE cs.class_id = c.id AND cs.stream_id = st.id
);

-- Add class_id column to students table (if not already present)
ALTER TABLE students ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
