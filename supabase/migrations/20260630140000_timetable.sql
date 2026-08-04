-- Timetable: period definitions (bell schedule)
CREATE TABLE IF NOT EXISTS periods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  period_number SMALLINT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_break BOOLEAN NOT NULL DEFAULT FALSE,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(period_number)
);

-- Timetable entries (class_stream + period + day → subject + teacher)
CREATE TABLE IF NOT EXISTS timetable_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  class_stream_id UUID NOT NULL REFERENCES class_streams(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  period_id UUID NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(period_id, day_of_week, academic_year_id, class_stream_id)
);

ALTER TABLE periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read periods" ON periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write periods" ON periods FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth read timetable_entries" ON timetable_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth write timetable_entries" ON timetable_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Default school bell schedule (7 teaching periods + 2 breaks)
INSERT INTO periods (period_number, start_time, end_time, is_break, label) VALUES
  (1,  '07:30', '08:25', false, 'Period 1'),
  (2,  '08:25', '09:20', false, 'Period 2'),
  (3,  '09:20', '10:15', false, 'Period 3'),
  (4,  '10:15', '10:35', true,  'Morning Break'),
  (5,  '10:35', '11:30', false, 'Period 4'),
  (6,  '11:30', '12:25', false, 'Period 5'),
  (7,  '12:25', '13:20', false, 'Period 6'),
  (8,  '13:20', '14:00', true,  'Lunch Break'),
  (9,  '14:00', '14:55', false, 'Period 7'),
  (10, '14:55', '15:50', false, 'Period 8')
ON CONFLICT (period_number) DO NOTHING;
