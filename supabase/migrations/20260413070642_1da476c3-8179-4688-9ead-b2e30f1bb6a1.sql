
-- Create enum for DAG types
CREATE TYPE public.dag_type AS ENUM ('error_collection', 'monitor');

-- Create enum for run status
CREATE TYPE public.dag_run_status AS ENUM ('running', 'success', 'failed');

-- DAG templates table
CREATE TABLE public.dag_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type public.dag_type NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.dag_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read dag_templates" ON public.dag_templates FOR SELECT USING (true);
CREATE POLICY "Anyone can insert dag_templates" ON public.dag_templates FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update dag_templates" ON public.dag_templates FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete dag_templates" ON public.dag_templates FOR DELETE USING (true);

-- DAG runs table
CREATE TABLE public.dag_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.dag_templates(id) ON DELETE CASCADE,
  status public.dag_run_status NOT NULL DEFAULT 'running',
  logs TEXT,
  error_details TEXT,
  fix_suggestion TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.dag_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read dag_runs" ON public.dag_runs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert dag_runs" ON public.dag_runs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update dag_runs" ON public.dag_runs FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete dag_runs" ON public.dag_runs FOR DELETE USING (true);

-- Trigger for updated_at on dag_templates
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_dag_templates_updated_at
  BEFORE UPDATE ON public.dag_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
