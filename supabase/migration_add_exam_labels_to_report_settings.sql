-- Add exam_label_1 and exam_label_2 columns to class_report_settings
ALTER TABLE class_report_settings
  ADD COLUMN IF NOT EXISTS exam_label_1 TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS exam_label_2 TEXT DEFAULT '';
