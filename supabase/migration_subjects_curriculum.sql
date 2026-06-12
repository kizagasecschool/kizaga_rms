-- ============================================================
-- KIZAGA RMS: Subjects Curriculum & A-Level Combinations
-- Idempotent migration — safe to run multiple times
-- Run this AFTER migration_tables.sql
-- ============================================================

-- ============================================================
-- 1. Add curriculum column to subjects (for O-Level: OLD/NEW)
-- ============================================================
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS curriculum TEXT CHECK (curriculum IN ('OLD', 'NEW'));

-- ============================================================
-- 2. A-Level Combinations
-- ============================================================
CREATE TABLE IF NOT EXISTS combinations (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  combination_name TEXT NOT NULL UNIQUE,
  description      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE combinations ADD COLUMN IF NOT EXISTS combination_name TEXT NOT NULL UNIQUE;
ALTER TABLE combinations ADD COLUMN IF NOT EXISTS description      TEXT;
ALTER TABLE combinations ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE combinations ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_combinations_name ON combinations(combination_name);

DROP TRIGGER IF EXISTS trg_combinations_updated_at ON combinations;
CREATE TRIGGER trg_combinations_updated_at
  BEFORE UPDATE ON combinations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 3. Combination-Subjects junction (A-Level subject roles)
-- ============================================================
CREATE TABLE IF NOT EXISTS combination_subjects (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  combination_id  UUID NOT NULL REFERENCES combinations(id) ON DELETE CASCADE,
  subject_id      UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  subject_role    TEXT NOT NULL CHECK (subject_role IN ('CORE', 'SUBSIDIARY', 'OPTIONAL')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE combination_subjects ADD COLUMN IF NOT EXISTS combination_id UUID NOT NULL REFERENCES combinations(id) ON DELETE CASCADE;
ALTER TABLE combination_subjects ADD COLUMN IF NOT EXISTS subject_id     UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE combination_subjects ADD COLUMN IF NOT EXISTS subject_role   TEXT NOT NULL CHECK (subject_role IN ('CORE', 'SUBSIDIARY', 'OPTIONAL'));
ALTER TABLE combination_subjects ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_combination_subjects_combination ON combination_subjects(combination_id);
CREATE INDEX IF NOT EXISTS idx_combination_subjects_subject     ON combination_subjects(subject_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_combination_subject') THEN
    ALTER TABLE combination_subjects ADD CONSTRAINT uq_combination_subject UNIQUE (combination_id, subject_id);
  END IF;
END $$;

-- ============================================================
-- 4. Row Level Security
-- ============================================================
ALTER TABLE combinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE combination_subjects ENABLE ROW LEVEL SECURITY;

-- Combinations
CREATE POLICY "admin_all_combinations" ON combinations
  FOR ALL USING (get_my_role() = 'admin');

CREATE POLICY "read_combinations" ON combinations
  FOR SELECT USING (get_my_role() IN ('headmaster', 'academic', 'teacher'));

CREATE POLICY "academic_rw_combinations" ON combinations
  FOR ALL USING (get_my_role() = 'academic');

-- Combination Subjects
CREATE POLICY "admin_all_combination_subjects" ON combination_subjects
  FOR ALL USING (get_my_role() = 'admin');

CREATE POLICY "read_combination_subjects" ON combination_subjects
  FOR SELECT USING (get_my_role() IN ('headmaster', 'academic', 'teacher'));

CREATE POLICY "academic_rw_combination_subjects" ON combination_subjects
  FOR ALL USING (get_my_role() = 'academic');

-- ============================================================
-- 5. Seed data: Common A-Level combinations
-- ============================================================
INSERT INTO combinations (combination_name, description)
SELECT v.name, v."desc"
FROM (VALUES
  ('PCB', 'Physics, Chemistry, Biology – Medicine and Health Sciences'),
  ('PCM', 'Physics, Chemistry, Advanced Mathematics – Engineering and Technology'),
  ('CBA', 'Chemistry, Biology, Agriculture – Agriculture and Environmental Sciences'),
  ('HGL', 'History, Geography, Kiswahili – Arts and Humanities'),
  ('ECA', 'Economics, Commerce, Accountancy – Business and Finance'),
  ('PGM', 'Physics, Geography, Advanced Mathematics – Geomatics and Surveying')
) AS v(name, "desc")
WHERE NOT EXISTS (SELECT 1 FROM combinations);

-- ============================================================
-- END
-- ============================================================
