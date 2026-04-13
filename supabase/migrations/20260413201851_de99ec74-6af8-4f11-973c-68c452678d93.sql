
-- dag_templates: drop all public policies, recreate for authenticated
DROP POLICY IF EXISTS "Anyone can delete dag_templates" ON public.dag_templates;
DROP POLICY IF EXISTS "Anyone can insert dag_templates" ON public.dag_templates;
DROP POLICY IF EXISTS "Anyone can read dag_templates" ON public.dag_templates;
DROP POLICY IF EXISTS "Anyone can update dag_templates" ON public.dag_templates;

CREATE POLICY "Authenticated users can read dag_templates" ON public.dag_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert dag_templates" ON public.dag_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update dag_templates" ON public.dag_templates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete dag_templates" ON public.dag_templates FOR DELETE TO authenticated USING (true);

-- dag_runs: drop all public policies, recreate for authenticated
DROP POLICY IF EXISTS "Anyone can delete dag_runs" ON public.dag_runs;
DROP POLICY IF EXISTS "Anyone can insert dag_runs" ON public.dag_runs;
DROP POLICY IF EXISTS "Anyone can read dag_runs" ON public.dag_runs;
DROP POLICY IF EXISTS "Anyone can update dag_runs" ON public.dag_runs;

CREATE POLICY "Authenticated users can read dag_runs" ON public.dag_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert dag_runs" ON public.dag_runs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update dag_runs" ON public.dag_runs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete dag_runs" ON public.dag_runs FOR DELETE TO authenticated USING (true);

-- dag_collected_errors: drop all public policies, recreate for authenticated
DROP POLICY IF EXISTS "Anyone can delete dag_collected_errors" ON public.dag_collected_errors;
DROP POLICY IF EXISTS "Anyone can insert dag_collected_errors" ON public.dag_collected_errors;
DROP POLICY IF EXISTS "Anyone can read dag_collected_errors" ON public.dag_collected_errors;
DROP POLICY IF EXISTS "Anyone can update dag_collected_errors" ON public.dag_collected_errors;

CREATE POLICY "Authenticated users can read dag_collected_errors" ON public.dag_collected_errors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert dag_collected_errors" ON public.dag_collected_errors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update dag_collected_errors" ON public.dag_collected_errors FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete dag_collected_errors" ON public.dag_collected_errors FOR DELETE TO authenticated USING (true);

-- dag_monitor_results: drop all public policies, recreate for authenticated
DROP POLICY IF EXISTS "Anyone can delete dag_monitor_results" ON public.dag_monitor_results;
DROP POLICY IF EXISTS "Anyone can insert dag_monitor_results" ON public.dag_monitor_results;
DROP POLICY IF EXISTS "Anyone can read dag_monitor_results" ON public.dag_monitor_results;
DROP POLICY IF EXISTS "Anyone can update dag_monitor_results" ON public.dag_monitor_results;

CREATE POLICY "Authenticated users can read dag_monitor_results" ON public.dag_monitor_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert dag_monitor_results" ON public.dag_monitor_results FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update dag_monitor_results" ON public.dag_monitor_results FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete dag_monitor_results" ON public.dag_monitor_results FOR DELETE TO authenticated USING (true);

-- custom_rules: drop all public policies, recreate for authenticated
DROP POLICY IF EXISTS "Anyone can delete custom rules" ON public.custom_rules;
DROP POLICY IF EXISTS "Anyone can insert custom rules" ON public.custom_rules;
DROP POLICY IF EXISTS "Anyone can read custom rules" ON public.custom_rules;

CREATE POLICY "Authenticated users can read custom_rules" ON public.custom_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert custom_rules" ON public.custom_rules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete custom_rules" ON public.custom_rules FOR DELETE TO authenticated USING (true);
