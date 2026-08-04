-- Subject allocations per class/stream (periods per week, single vs double, special flag)
CREATE TABLE IF NOT EXISTS timetable_allocations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  class_stream_id UUID NOT NULL REFERENCES class_streams(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  subject_name TEXT, -- denormalized fallback
  teacher_name TEXT,
  periods_per_week SMALLINT NOT NULL DEFAULT 5,
  is_double BOOLEAN NOT NULL DEFAULT FALSE, -- double period = 80 min
  is_special BOOLEAN NOT NULL DEFAULT FALSE, -- special (Religion, Debate) = place manually
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(academic_year_id, class_stream_id, subject_id)
);

ALTER TABLE timetable_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth access timetable_allocations" ON timetable_allocations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add double_period flag to timetable_entries too
ALTER TABLE timetable_entries ADD COLUMN IF NOT EXISTS is_double BOOLEAN NOT NULL DEFAULT FALSE;
