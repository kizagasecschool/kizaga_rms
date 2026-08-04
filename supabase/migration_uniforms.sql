-- Uniforms management table

CREATE TABLE IF NOT EXISTS uniforms (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('SCHOOL', 'HOSTEL', 'SHAMBA', 'SPORTS')),
  class_level TEXT NOT NULL DEFAULT 'ALL',
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  items JSONB DEFAULT '[]',
  gender TEXT DEFAULT '',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE uniforms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_uniforms" ON uniforms;
CREATE POLICY "public_select_uniforms"
  ON uniforms FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "admin_headmaster_all_uniforms" ON uniforms;
CREATE POLICY "admin_headmaster_all_uniforms"
  ON uniforms FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'headmaster')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'headmaster')
    )
  );

DROP TRIGGER IF EXISTS trg_uniforms_updated_at ON uniforms;
CREATE TRIGGER trg_uniforms_updated_at
  BEFORE UPDATE ON uniforms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RPC bypass RLS for admin/headmaster
CREATE OR REPLACE FUNCTION get_uniforms()
RETURNS SETOF uniforms
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT * FROM uniforms ORDER BY sort_order, created_at;
END;
$$;

CREATE OR REPLACE FUNCTION save_uniform(
  p_category TEXT,
  p_class_level TEXT,
  p_title TEXT,
  p_description TEXT DEFAULT '',
  p_image_url TEXT DEFAULT '',
  p_items JSONB DEFAULT '[]',
  p_gender TEXT DEFAULT '',
  p_sort_order INT DEFAULT 0,
  p_id UUID DEFAULT NULL
)
RETURNS uniforms
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result uniforms;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'headmaster')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_id IS NOT NULL THEN
    UPDATE uniforms SET
      category = p_category,
      class_level = p_class_level,
      title = p_title,
      description = p_description,
      image_url = p_image_url,
      items = p_items,
      gender = p_gender,
      sort_order = p_sort_order,
      updated_at = NOW()
    WHERE id = p_id
    RETURNING * INTO result;
    RETURN result;
  ELSE
    INSERT INTO uniforms (category, class_level, title, description, image_url, items, gender, sort_order)
    VALUES (p_category, p_class_level, p_title, p_description, p_image_url, p_items, p_gender, p_sort_order)
    RETURNING * INTO result;
    RETURN result;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION delete_uniform(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'headmaster')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  DELETE FROM uniforms WHERE id = p_id;
  RETURN FOUND;
END;
$$;
