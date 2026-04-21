-- Repositories the user registers
CREATE TABLE public.repositories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  github_owner TEXT NOT NULL,
  github_repo TEXT NOT NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  plugins_path TEXT,
  lib_path TEXT,
  description TEXT,
  last_ingested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Multiple DAG / slimline paths per repository
CREATE TABLE public.repository_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'dags', -- dags | slimline | plugins | lib
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_repository_paths_repo ON public.repository_paths(repository_id);

-- Files pulled from a repository
CREATE TABLE public.ingested_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE,
  repository_path_id UUID REFERENCES public.repository_paths(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'dag', -- dag | plugin | lib | other
  content TEXT,
  sha TEXT,
  size_bytes INTEGER,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ingested_files_repo ON public.ingested_files(repository_id);
CREATE INDEX idx_ingested_files_kind ON public.ingested_files(kind);

-- Per-file AI analysis
CREATE TABLE public.file_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES public.ingested_files(id) ON DELETE CASCADE,
  repository_id UUID NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE,
  structure_summary TEXT,
  patterns JSONB DEFAULT '[]'::jsonb,
  required_changes JSONB DEFAULT '[]'::jsonb,
  migrated_code TEXT,
  airflow3_ready BOOLEAN DEFAULT false,
  python313_ready BOOLEAN DEFAULT false,
  analysis_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_file_insights_repo ON public.file_insights(repository_id);
CREATE INDEX idx_file_insights_file ON public.file_insights(file_id);

-- Aggregated insights at repo / global level
CREATE TABLE public.repo_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID REFERENCES public.repositories(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'repo', -- repo | global
  category TEXT NOT NULL, -- coding_standard | pattern | migration_rule | structure
  title TEXT NOT NULL,
  detail TEXT,
  examples JSONB DEFAULT '[]'::jsonb,
  occurrences INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_repo_insights_repo ON public.repo_insights(repository_id);
CREATE INDEX idx_repo_insights_category ON public.repo_insights(category);

-- PR-based deployments
CREATE TABLE public.deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_repository_id UUID NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE,
  target_path TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  pr_title TEXT NOT NULL,
  pr_body TEXT,
  pr_number INTEGER,
  pr_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | created | merged | failed
  file_ids UUID[] NOT NULL DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS + permissive policies (no auth in app yet, matches existing tables)
ALTER TABLE public.repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repository_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingested_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repo_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public all repositories" ON public.repositories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public all repository_paths" ON public.repository_paths FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public all ingested_files" ON public.ingested_files FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public all file_insights" ON public.file_insights FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public all repo_insights" ON public.repo_insights FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public all deployments" ON public.deployments FOR ALL USING (true) WITH CHECK (true);

-- updated_at triggers
CREATE TRIGGER trg_repositories_updated BEFORE UPDATE ON public.repositories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_repo_insights_updated BEFORE UPDATE ON public.repo_insights
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_deployments_updated BEFORE UPDATE ON public.deployments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();