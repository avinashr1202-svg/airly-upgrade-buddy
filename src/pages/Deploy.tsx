import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Rocket, GitPullRequest, Loader2, ExternalLink, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Repo { id: string; name: string; github_owner: string; github_repo: string; default_branch: string; }
interface RepoPath { id: string; repository_id: string; kind: string; path: string; }
interface IngestedFile { id: string; file_name: string; file_path: string; repository_id: string; kind: string; }
interface Deployment {
  id: string; pr_title: string; pr_url: string | null; pr_number: number | null;
  branch_name: string; status: string; target_path: string; target_repository_id: string;
  created_at: string; file_ids: string[];
}

const Deploy = () => {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [paths, setPaths] = useState<RepoPath[]>([]);
  const [files, setFiles] = useState<IngestedFile[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [sourceRepo, setSourceRepo] = useState<string>("");
  const [targetRepo, setTargetRepo] = useState<string>("");
  const [targetPath, setTargetPath] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [prTitle, setPrTitle] = useState("Migrate DAGs to Airflow 3.x");
  const [deploying, setDeploying] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [r, p, f, d] = await Promise.all([
      supabase.from("repositories").select("*"),
      supabase.from("repository_paths").select("*"),
      supabase.from("ingested_files").select("*"),
      supabase.from("deployments").select("*").order("created_at", { ascending: false }),
    ]);
    setRepos((r.data as Repo[]) ?? []);
    setPaths((p.data as RepoPath[]) ?? []);
    setFiles((f.data as IngestedFile[]) ?? []);
    setDeployments((d.data as Deployment[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const sourceFiles = useMemo(() => files.filter(f => f.repository_id === sourceRepo), [files, sourceRepo]);
  const targetPaths = useMemo(() => paths.filter(p => p.repository_id === targetRepo), [paths, targetRepo]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const deploy = async () => {
    if (!targetRepo || !targetPath || selected.size === 0) {
      toast.error("Pick target repo, path and at least one file");
      return;
    }
    setDeploying(true);
    try {
      const branch = `migration/airflow3-${Date.now().toString(36)}`;
      const target = repos.find(r => r.id === targetRepo)!;
      const prNumber = Math.floor(Math.random() * 9000) + 1000;
      const prUrl = `https://github.com/${target.github_owner}/${target.github_repo}/pull/${prNumber}`;
      // simulate work
      await new Promise(r => setTimeout(r, 1200));
      const { error } = await supabase.from("deployments").insert({
        pr_title: prTitle,
        pr_body: `Automated migration of ${selected.size} DAG file(s) for Airflow 3.x compatibility.`,
        pr_url: prUrl,
        pr_number: prNumber,
        branch_name: branch,
        status: "open",
        target_path: targetPath,
        target_repository_id: targetRepo,
        file_ids: Array.from(selected),
      });
      if (error) throw error;
      toast.success(`PR #${prNumber} created (sample)`);
      setSelected(new Set());
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Deployment failed");
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
          <div className="animate-fade-in">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Rocket className="w-4 h-4" /> Deploy</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Pick migrated files and raise a Pull Request to a target repository path.
            </p>
          </div>

          <Separator />

          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-semibold">1. Source — pick files</h3>
              <Select value={sourceRepo} onValueChange={(v) => { setSourceRepo(v); setSelected(new Set()); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Source repository" /></SelectTrigger>
                <SelectContent>
                  {repos.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="border border-border rounded-md max-h-72 overflow-y-auto scrollbar-thin">
                {sourceFiles.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-4 text-center">No ingested files. Ingest a repo first.</p>
                ) : sourceFiles.map(f => (
                  <label key={f.id} className="flex items-center gap-2 px-3 py-2 hover:bg-accent/40 cursor-pointer border-b border-border last:border-0">
                    <Checkbox checked={selected.has(f.id)} onCheckedChange={() => toggle(f.id)} />
                    <span className="text-xs font-mono flex-1 truncate">{f.file_path}</span>
                    <Badge variant="outline" className="text-[10px]">{f.kind}</Badge>
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">{selected.size} file(s) selected</p>
            </Card>

            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-semibold">2. Target — choose destination</h3>
              <div className="space-y-1.5">
                <Label className="text-xs">Target Repository</Label>
                <Select value={targetRepo} onValueChange={(v) => { setTargetRepo(v); setTargetPath(""); }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Target repository" /></SelectTrigger>
                  <SelectContent>
                    {repos.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Target Path</Label>
                <Select value={targetPath} onValueChange={setTargetPath} disabled={!targetRepo}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pick a path" /></SelectTrigger>
                  <SelectContent>
                    {targetPaths.map(p => <SelectItem key={p.id} value={p.path}>{p.path} ({p.kind})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">PR Title</Label>
                <Input className="h-8 text-xs" value={prTitle} onChange={e => setPrTitle(e.target.value)} />
              </div>
              <Button size="sm" className="w-full gap-1.5" onClick={deploy} disabled={deploying}>
                {deploying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitPullRequest className="w-3.5 h-3.5" />}
                {deploying ? "Creating PR..." : "Create Pull Request"}
              </Button>
            </Card>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2">Recent Deployments</h3>
            {loading ? (
              <p className="text-xs text-muted-foreground">Loading...</p>
            ) : deployments.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-xs text-muted-foreground">No deployments yet.</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {deployments.map(d => {
                  const target = repos.find(r => r.id === d.target_repository_id);
                  return (
                    <Card key={d.id} className="p-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            <p className="text-sm font-medium truncate">{d.pr_title}</p>
                            <Badge variant="outline" className="text-[10px]">{d.status}</Badge>
                            <Badge variant="outline" className="text-[10px] font-mono">#{d.pr_number}</Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1 font-mono">
                            {target?.github_owner}/{target?.github_repo} → {d.target_path} · {d.file_ids.length} file(s) · {d.branch_name}
                          </p>
                        </div>
                        {d.pr_url && (
                          <Button asChild size="sm" variant="outline" className="h-7 text-xs gap-1">
                            <a href={d.pr_url} target="_blank" rel="noreferrer">View PR <ExternalLink className="w-3 h-3" /></a>
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Deploy;
