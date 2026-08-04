-- Create class_report_settings table for per-class report configuration
CREATE TABLE IF NOT EXISTS class_report_settings (
  class_id UUID PRIMARY KEY REFERENCES classes(id) ON DELETE CASCADE,
  report_heading TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_class_report_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_class_report_settings_updated_at
  BEFORE UPDATE ON class_report_settings
  FOR EACH ROW EXECUTE FUNCTION update_class_report_settings_updated_at();

-- Enable RLS
ALTER TABLE class_report_settings ENABLE ROW LEVEL SECURITY;

-- Policies for staff access
CREATE POLICY "Staff can select class_report_settings" ON class_report_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'headmaster', 'academic', 'teacher')
    )
  );

CREATE POLICY "Staff can insert class_report_settings" ON class_report_settings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'headmaster', 'academic', 'teacher')
    )
  );

CREATE POLICY "Staff can update class_report_settings" ON class_report_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'headmaster', 'academic', 'teacher')
    )
  );
