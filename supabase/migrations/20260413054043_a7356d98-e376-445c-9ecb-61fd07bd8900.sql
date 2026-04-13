
-- Custom migration rules table (no auth required - public tool)
CREATE TABLE public.custom_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'Custom',
  from_pattern TEXT NOT NULL,
  to_pattern TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Public access (no auth needed for this utility tool)
ALTER TABLE public.custom_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read custom rules"
  ON public.custom_rules FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert custom rules"
  ON public.custom_rules FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can delete custom rules"
  ON public.custom_rules FOR DELETE
  USING (true);
