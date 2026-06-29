CREATE TABLE IF NOT EXISTS public.stream_combinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_stream_id UUID NOT NULL UNIQUE REFERENCES public.class_streams(id) ON DELETE CASCADE,
  combination_id UUID NOT NULL REFERENCES public.combinations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.stream_combinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stream_combinations_allow_authenticated"
  ON public.stream_combinations
  FOR ALL
  USING (auth.role() = 'authenticated');
