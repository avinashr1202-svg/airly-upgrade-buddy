import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { GitBranch, Plus, Trash2, FolderTree, Package, Library, FileCode, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Repo {
  id: string;
  name: string;
  github_owner: string;
  github_repo: string;
  default_branch: string;
  description: string | null;
  plugins_path: string | null;
  lib_path: string | null;
  last_ingested_at: string | null;
}

interface RepoPath {
  id: string;
  repository_id: string;
  kind: string;
  path: string;
  label: string | null;
}

const SAMPLE_FILES = [
  { name: "etl_daily.py", path: "dags/d01/etl_daily.py" },
  { name: "report_weekly.py", path: "dags/d01/report_weekly.py" },
  { name: "ingest_api.py", path: "dags/d02/ingest_api.py" },
  { name: "common_utils.py", path: "dags/udw/lib/common_utils.py" },
  { name: "slack_notifier.py", path: "plugins/slack_notifier.py" },
];

const Repositories = () => {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [paths, setPaths] = useState<RepoPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", github_owner: "", github_repo: "", default_branch: "main",
    description: "", plugins_path: "plugins", lib_path: "dags/udw/lib",
    dag_paths: "dags/d01,dags/d02",
  });

  const load = async () => {
    setLoading(true);
    const [r, p] = await Promise.all([
      supabase.from("repositories").select("*").order("created_at", { ascending: false }),
      supabase.from("repository_paths").select("*"),
    ]);
    setRepos((r.data as Repo[]) ?? []);
    setPaths((p.data as RepoPath[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createRepo = async () => {
    if (!form.name || !form.github_owner || !form.github_repo) {
      toast.error("Name, owner and repo are required");
      return;
    }
    const { data, error } = await supabase.from("repositories").insert({
      name: form.name, github_owner: form.github_owner, github_repo: form.github_repo,
      default_branch: form.default_branch, description: form.description || null,
      plugins_path: form.plugins_path || null, lib_path: form.lib_path || null,
    }).select().single();
    if (error) { toast.error(error.message); return; }

    const dagPaths = form.dag_paths.split(",").map(s => s.trim()).filter(Boolean);
    if (dagPaths.length) {
      await supabase.from("repository_paths").insert(
        dagPaths.map(p => ({ repository_id: data!.id, kind: "dag", path: p, label: p.split("/").pop() }))
      );
    }
    toast.success("Repository registered");
    setOpen(false);
    setForm({ ...form, name: "", github_owner: "", github_repo: "", description: "" });
    load();
  };

  const removeRepo = async (id: string) => {
    await supabase.from("repositories").delete().eq("id", id);
    toast.success("Repository removed");
    load();
  };

  const ingest = async (repo: Repo) => {
    setIngesting(repo.id);
    try {
      // Sample/mock ingestion — inserts files + AI-style insights
      const fileRows = SAMPLE_FILES.map(f => ({
        repository_id: repo.id,
        file_name: f.name,
        file_path: f.path,
        kind: f.path.startsWith("plugins") ? "plugin" : f.path.includes("/lib/") ? "lib" : "dag",
        sha: crypto.randomUUID().slice(0, 12),
        size_bytes: Math.floor(Math.random() * 8000) + 500,
        content: `# Sample DAG ${f.name}\nfrom airflow import DAG\nfrom airflow.operators.python import PythonOperator\n# ... (mock content)`,
      }));
      const { data: files, error: fErr } = await supabase
        .from("ingested_files").insert(fileRows).select();
      if (fErr) throw fErr;

      // File-level insights
      const insights = (files ?? []).map((f: any) => ({
        repository_id: repo.id,
        file_id: f.id,
        airflow3_ready: Math.random() > 0.5,
        python313_ready: Math.random() > 0.4,
        structure_summary: "Standard DAG with 2 tasks using PythonOperator and a single dependency chain.",
        analysis_notes: "Uses deprecated `provide_context=True`; `schedule_interval` should become `schedule`.",
        patterns: { uses_python_operator: true, has_xcom: Math.random() > 0.5 },
        required_changes: [
          "Replace `schedule_interval` with `schedule`",
          "Remove `provide_context=True` (Airflow 3 always provides context)",
          "Update `from airflow.operators.python_operator` → `airflow.operators.python`",
        ],
        migrated_code: `# Migrated for Airflow 3.x\nfrom airflow import DAG\nfrom airflow.operators.python import PythonOperator\n# ...`,
      }));
      await supabase.from("file_insights").insert(insights);

      // Repo-level aggregated insights
      await supabase.from("repo_insights").insert([
        { repository_id: repo.id, scope: "repo", category: "pattern", title: "PythonOperator dominant", detail: "85% of DAGs rely on PythonOperator with shared lib helpers.", occurrences: Math.floor(SAMPLE_FILES.length * 0.85) },
        { repository_id: repo.id, scope: "repo", category: "migration_rule", title: "schedule_interval → schedule", detail: "Airflow 3 renamed `schedule_interval` to `schedule`. Apply across all DAGs.", occurrences: SAMPLE_FILES.length },
        { repository_id: repo.id, scope: "repo", category: "standard", title: "Naming convention", detail: "All DAG files use snake_case with `_daily` / `_weekly` suffix.", occurrences: SAMPLE_FILES.length },
        { repository_id: repo.id, scope: "repo", category: "migration_rule", title: "Operator import paths", detail: "Old `airflow.operators.python_operator` must move to `airflow.operators.python`.", occurrences: SAMPLE_FILES.length },
      ]);

      await supabase.from("repositories").update({ last_ingested_at: new Date().toISOString() }).eq("id", repo.id);
      toast.success(`Ingested ${SAMPLE_FILES.length} files from ${repo.name}`);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Ingestion failed");
    } finally {
      setIngesting(null);
    }
  };

  const getDagPaths = (repoId: string) => paths.filter(p => p.repository_id === repoId && p.kind === "dag");

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
          <div className="flex items-start justify-between gap-2 animate-fade-in">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <GitBranch className="w-4 h-4" /> Repositories
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Register GitHub repositories. Sample ingestion populates files + AI insights you can review.
              </p>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Add Repository</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Register Repository</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Display Name</Label>
                      <Input className="h-8 text-xs" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Data Platform" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Default Branch</Label>
                      <Input className="h-8 text-xs" value={form.default_branch} onChange={e => setForm({ ...form, default_branch: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">GitHub Owner</Label>
                      <Input className="h-8 text-xs" value={form.github_owner} onChange={e => setForm({ ...form, github_owner: e.target.value })} placeholder="my-org" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Repo Name</Label>
                      <Input className="h-8 text-xs" value={form.github_repo} onChange={e => setForm({ ...form, github_repo: e.target.value })} placeholder="airflow-dags" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">DAG Paths (comma-separated, e.g. dags/d01,dags/d02)</Label>
                    <Input className="h-8 text-xs" value={form.dag_paths} onChange={e => setForm({ ...form, dag_paths: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Plugins Path</Label>
                      <Input className="h-8 text-xs" value={form.plugins_path} onChange={e => setForm({ ...form, plugins_path: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Library Path</Label>
                      <Input className="h-8 text-xs" value={form.lib_path} onChange={e => setForm({ ...form, lib_path: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Description</Label>
                    <Input className="h-8 text-xs" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional" />
                  </div>
                </div>
                <DialogFooter>
                  <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button size="sm" onClick={createRepo}>Register</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Separator />

          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading...
            </div>
          ) : repos.length === 0 ? (
            <Card className="p-8 text-center">
              <GitBranch className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">No repositories yet</p>
              <p className="text-xs text-muted-foreground mt-1">Click "Add Repository" to register one with sample data.</p>
            </Card>
          ) : (
            <div className="grid gap-3">
              {repos.map((r, i) => {
                const dagPaths = getDagPaths(r.id);
                return (
                  <Card key={r.id} className="p-4 animate-slide-up hover:border-primary/30 transition-all" style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold">{r.name}</h3>
                          <Badge variant="outline" className="text-[10px]">{r.github_owner}/{r.github_repo}</Badge>
                          <Badge variant="outline" className="text-[10px]">{r.default_branch}</Badge>
                          {r.last_ingested_at && (
                            <Badge className="text-[10px] bg-green-500/15 text-green-600 border-green-500/30">
                              Ingested {new Date(r.last_ingested_at).toLocaleString()}
                            </Badge>
                          )}
                        </div>
                        {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}

                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {dagPaths.map(p => (
                            <Badge key={p.id} variant="secondary" className="text-[10px] gap-1">
                              <FolderTree className="w-3 h-3" />{p.path}
                            </Badge>
                          ))}
                          {r.plugins_path && (
                            <Badge variant="secondary" className="text-[10px] gap-1">
                              <Package className="w-3 h-3" />{r.plugins_path}
                            </Badge>
                          )}
                          {r.lib_path && (
                            <Badge variant="secondary" className="text-[10px] gap-1">
                              <Library className="w-3 h-3" />{r.lib_path}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => ingest(r)} disabled={ingesting === r.id}>
                          {ingesting === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          {r.last_ingested_at ? "Re-ingest" : "Ingest"}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeRepo(r.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-2">
            <FileCode className="w-3 h-3" /> Sample mode: ingestion creates mock files + AI insights. Wire your GitHub token later in Settings to ingest real repos.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Repositories;
