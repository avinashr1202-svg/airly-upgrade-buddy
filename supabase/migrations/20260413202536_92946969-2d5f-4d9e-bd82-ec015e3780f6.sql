
-- Revert to public access since no auth is implemented

-- dag_templates
DROP POLICY IF EXISTS "Authenticated users can read dag_templates" ON public.dag_templates;
DROP POLICY IF EXISTS "Authenticated users can insert dag_templates" ON public.dag_templates;
DROP POLICY IF EXISTS "Authenticated users can update dag_templates" ON public.dag_templates;
DROP POLICY IF EXISTS "Authenticated users can delete dag_templates" ON public.dag_templates;

CREATE POLICY "Public read dag_templates" ON public.dag_templates FOR SELECT USING (true);
CREATE POLICY "Public insert dag_templates" ON public.dag_templates FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update dag_templates" ON public.dag_templates FOR UPDATE USING (true);
CREATE POLICY "Public delete dag_templates" ON public.dag_templates FOR DELETE USING (true);

-- dag_runs
DROP POLICY IF EXISTS "Authenticated users can read dag_runs" ON public.dag_runs;
DROP POLICY IF EXISTS "Authenticated users can insert dag_runs" ON public.dag_runs;
DROP POLICY IF EXISTS "Authenticated users can update dag_runs" ON public.dag_runs;
DROP POLICY IF EXISTS "Authenticated users can delete dag_runs" ON public.dag_runs;

CREATE POLICY "Public read dag_runs" ON public.dag_runs FOR SELECT USING (true);
CREATE POLICY "Public insert dag_runs" ON public.dag_runs FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update dag_runs" ON public.dag_runs FOR UPDATE USING (true);
CREATE POLICY "Public delete dag_runs" ON public.dag_runs FOR DELETE USING (true);

-- dag_collected_errors
DROP POLICY IF EXISTS "Authenticated users can read dag_collected_errors" ON public.dag_collected_errors;
DROP POLICY IF EXISTS "Authenticated users can insert dag_collected_errors" ON public.dag_collected_errors;
DROP POLICY IF EXISTS "Authenticated users can update dag_collected_errors" ON public.dag_collected_errors;
DROP POLICY IF EXISTS "Authenticated users can delete dag_collected_errors" ON public.dag_collected_errors;

CREATE POLICY "Public read dag_collected_errors" ON public.dag_collected_errors FOR SELECT USING (true);
CREATE POLICY "Public insert dag_collected_errors" ON public.dag_collected_errors FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update dag_collected_errors" ON public.dag_collected_errors FOR UPDATE USING (true);
CREATE POLICY "Public delete dag_collected_errors" ON public.dag_collected_errors FOR DELETE USING (true);

-- dag_monitor_results
DROP POLICY IF EXISTS "Authenticated users can read dag_monitor_results" ON public.dag_monitor_results;
DROP POLICY IF EXISTS "Authenticated users can insert dag_monitor_results" ON public.dag_monitor_results;
DROP POLICY IF EXISTS "Authenticated users can update dag_monitor_results" ON public.dag_monitor_results;
DROP POLICY IF EXISTS "Authenticated users can delete dag_monitor_results" ON public.dag_monitor_results;

CREATE POLICY "Public read dag_monitor_results" ON public.dag_monitor_results FOR SELECT USING (true);
CREATE POLICY "Public insert dag_monitor_results" ON public.dag_monitor_results FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update dag_monitor_results" ON public.dag_monitor_results FOR UPDATE USING (true);
CREATE POLICY "Public delete dag_monitor_results" ON public.dag_monitor_results FOR DELETE USING (true);

-- custom_rules
DROP POLICY IF EXISTS "Authenticated users can read custom_rules" ON public.custom_rules;
DROP POLICY IF EXISTS "Authenticated users can insert custom_rules" ON public.custom_rules;
DROP POLICY IF EXISTS "Authenticated users can delete custom_rules" ON public.custom_rules;

CREATE POLICY "Public read custom_rules" ON public.custom_rules FOR SELECT USING (true);
CREATE POLICY "Public insert custom_rules" ON public.custom_rules FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete custom_rules" ON public.custom_rules FOR DELETE USING (true);
