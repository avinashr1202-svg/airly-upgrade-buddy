
-- Table for errors collected by Error Collection DAGs
CREATE TABLE public.dag_collected_errors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.dag_templates(id) ON DELETE CASCADE,
  run_id UUID REFERENCES public.dag_runs(id) ON DELETE SET NULL,
  dag_name TEXT NOT NULL,
  task_id TEXT,
  error_message TEXT NOT NULL,
  short_description TEXT,
  fix_steps TEXT,
  severity TEXT NOT NULL DEFAULT 'error',
  execution_date TIMESTAMP WITH TIME ZONE,
  collected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.dag_collected_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read dag_collected_errors" ON public.dag_collected_errors FOR SELECT USING (true);
CREATE POLICY "Anyone can insert dag_collected_errors" ON public.dag_collected_errors FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update dag_collected_errors" ON public.dag_collected_errors FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete dag_collected_errors" ON public.dag_collected_errors FOR DELETE USING (true);

-- Table for monitor DAG results
CREATE TABLE public.dag_monitor_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.dag_templates(id) ON DELETE CASCADE,
  run_id UUID REFERENCES public.dag_runs(id) ON DELETE SET NULL,
  dag_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  duration_seconds NUMERIC,
  last_run_at TIMESTAMP WITH TIME ZONE,
  is_smoke_tested BOOLEAN NOT NULL DEFAULT false,
  log_info TEXT,
  error_details TEXT,
  fix_steps TEXT,
  paths_covered TEXT,
  collected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.dag_monitor_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read dag_monitor_results" ON public.dag_monitor_results FOR SELECT USING (true);
CREATE POLICY "Anyone can insert dag_monitor_results" ON public.dag_monitor_results FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update dag_monitor_results" ON public.dag_monitor_results FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete dag_monitor_results" ON public.dag_monitor_results FOR DELETE USING (true);
