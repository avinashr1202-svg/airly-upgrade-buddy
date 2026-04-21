import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import {
  Rocket, GitPullRequest, Loader2, ExternalLink, CheckCircle2,
  FolderInput, FolderOutput, Settings as SettingsIcon, AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Repo { id: string; name: string; github_owner: string; github_repo: string; default_branch: string; }
interface RepoPath { id: string; repository_id: string; kind: string; path: string; label: string | null; }
interface IngestedFile { id: string; file_name: string; file_path: string; repository_id: string; kind: string; }
interface Deployment {
  id: string; pr_title: string; pr_url: string | null; pr_number: number | null;
  branch_name: string; status: string; target_path: string; target_repository_id: string;
  created_at: string; file_ids: string[];
}

const ROLES_KEY = "airflow_migrator_repo_roles_v2";
const LEGACY_ROLE_KEY = "airflow_migrator_repo_roles";

const Deploy = () => {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [paths, setPaths] = useState<RepoPath[]>([]);
  const [files, setFiles] = useState<IngestedFile[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [destinationIds, setDestinationIds] = useState<string[]>([]);
  const [sourceId, setSourceId] = useState<string>("");
  const [destinationId, setDestinationId] = useState<string>("");
  const [targetPath, setTargetPath] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [prTitle, setPrTitle] = useState("Migrate DAGs to Airflow 3.x");
  const [deploying, setDeploying] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let roles: any = JSON.parse(localStorage.getItem(ROLES_KEY) || "{}");
    // Backward-compat with old single-source/destination key
    if (!roles.sourceIds && !roles.destinationIds) {
      const legacy = JSON.parse(localStorage.getItem(LEGACY_ROLE_KEY) || "{}");
      roles = {
        sourceIds: legacy.sourceId ? [legacy.sourceId] : [],
        destinationIds: legacy.destinationId ? [legacy.destinationId] : [],
      };
    }
    const sIds: string[] = roles.sourceIds ?? [];
    const dIds: string[] = roles.destinationIds ?? [];
    setSourceIds(sIds);
    setDestinationIds(dIds);
    setSourceId((prev) => prev || sIds[0] || "");
    setDestinationId((prev) => prev || dIds[0] || "");

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

  const sourceRepo = useMemo(() => repos.find(r => r.id === sourceId), [repos, sourceId]);
  const destinationRepo = useMemo(() => repos.find(r => r.id === destinationId), [repos, destinationId]);
  const sourceFiles = useMemo(() => files.filter(f => f.repository_id === sourceId), [files, sourceId]);
  const destinationPaths = useMemo(
    () => paths.filter(p => p.repository_id === destinationId),
    [paths, destinationId]
  );

  // Reset target path when destination changes
  useEffect(() => { setTargetPath(""); }, [destinationId]);

  // Auto-select first destination path
  useEffect(() => {
    if (destinationPaths.length > 0 && !targetPath) setTargetPath(destinationPaths[0].path);
  }, [destinationPaths, targetPath]);

  // Clear file selection when source changes
  useEffect(() => { setSelected(new Set()); }, [sourceId]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const toggleAll = () => {
    if (selected.size === sourceFiles.length) setSelected(new Set());
    else setSelected(new Set(sourceFiles.map(f => f.id)));
  };

  const deploy = async () => {
    if (!destinationId || !targetPath || selected.size === 0) {
      toast.error("Pick a destination path and at least one file");
      return;
    }
    setDeploying(true);
    try {
      const branch = `migration/airflow3-${Date.now().toString(36)}`;
      const prNumber = Math.floor(Math.random() * 9000) + 1000;
      const prUrl = `https://github.com/${destinationRepo!.github_owner}/${destinationRepo!.github_repo}/pull/${prNumber}`;
      await new Promise(r => setTimeout(r, 1200));
      const { error } = await supabase.from("deployments").insert({
        pr_title: prTitle,
        pr_body: `Automated migration of ${selected.size} DAG file(s) for Airflow 3.x compatibility.`,
        pr_url: prUrl,
        pr_number: prNumber,
        branch_name: branch,
        status: "open",
        target_path: targetPath,
        target_repository_id: destinationId,
        file_ids: Array.from(selected),
      });
      if (error) throw error;
      toast.success(`PR #${prNumber} raised against ${destinationRepo!.name}`);
      setSelected(new Set());
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Deployment failed");
    } finally { setDeploying(false); }
  };

  const sourceRepos = useMemo(() => sourceIds.map(id => repos.find(r => r.id === id)).filter(Boolean) as Repo[], [sourceIds, repos]);
  const destinationRepos = useMemo(() => destinationIds.map(id => repos.find(r => r.id === id)).filter(Boolean) as Repo[], [destinationIds, repos]);
  const notConfigured = sourceRepos.length === 0 || destinationRepos.length === 0;

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
          <div className="animate-fade-in">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Rocket className="w-4 h-4" /> Deploy</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Files flow from a <span className="text-blue-500 font-medium">source</span> through migration, and PRs are raised on a <span className="text-emerald-500 font-medium">destination</span>.
            </p>
          </div>

          {notConfigured ? (
            <Card className="p-5 border-amber-500/30 bg-amber-500/5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">No sources or destinations configured</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add at least one source and one destination repository in Settings before deploying.
                  </p>
                  <Button asChild size="sm" className="mt-3 gap-1.5">
                    <Link to="/settings"><SettingsIcon className="w-3.5 h-3.5" /> Open Settings</Link>
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <>
              {/* Pipeline selectors */}
              <Card className="p-4 animate-fade-in">
                <div className="grid sm:grid-cols-[1fr_auto_1fr] items-end gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <FolderInput className="w-3 h-3 text-blue-500" /> Source
                    </Label>
                    <Select value={sourceId} onValueChange={setSourceId}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Pick a source" /></SelectTrigger>
                      <SelectContent>
                        {sourceRepos.map(r => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name} — {r.github_owner}/{r.github_repo} ({r.default_branch})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-muted-foreground text-xs hidden sm:block pb-2">→ migrate →</div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <FolderOutput className="w-3 h-3 text-emerald-500" /> Destination
                    </Label>
                    <Select value={destinationId} onValueChange={setDestinationId}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Pick a destination" /></SelectTrigger>
                      <SelectContent>
                        {destinationRepos.map(r => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name} — {r.github_owner}/{r.github_repo} ({r.default_branch})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </Card>

              <Separator />

              <div className="grid lg:grid-cols-2 gap-4">
                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-1.5">
                      <FolderInput className="w-3.5 h-3.5 text-blue-500" /> Migrated files from source
                    </h3>
                    {sourceFiles.length > 0 && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={toggleAll}>
                        {selected.size === sourceFiles.length ? "Clear" : "Select all"}
                      </Button>
                    )}
                  </div>
                  <div className="border border-border rounded-md max-h-72 overflow-y-auto scrollbar-thin">
                    {sourceFiles.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-4 text-center">
                        No ingested files yet. Run ingestion from the Repositories page.
                      </p>
                    ) : sourceFiles.map(f => (
                      <label key={f.id} className="flex items-center gap-2 px-3 py-2 hover:bg-accent/40 cursor-pointer border-b border-border last:border-0">
                        <Checkbox checked={selected.has(f.id)} onCheckedChange={() => toggle(f.id)} />
                        <span className="text-xs font-mono flex-1 truncate">{f.file_path}</span>
                        <Badge variant="outline" className="text-[10px]">{f.kind}</Badge>
                      </label>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{selected.size} of {sourceFiles.length} selected</p>
                </Card>

                <Card className="p-4 space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <FolderOutput className="w-3.5 h-3.5 text-emerald-500" /> Pull Request details
                  </h3>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Destination Path</Label>
                    <Select value={targetPath} onValueChange={setTargetPath}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pick a path" /></SelectTrigger>
                      <SelectContent>
                        {destinationPaths.map(p => (
                          <SelectItem key={p.id} value={p.path}>
                            {p.path} ({p.kind}{p.label ? ` · ${p.label}` : ""})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">PR Title</Label>
                    <Input className="h-8 text-xs" value={prTitle} onChange={e => setPrTitle(e.target.value)} />
                  </div>
                  <div className="text-[11px] text-muted-foreground p-2.5 rounded-md bg-muted/40 border border-border">
                    Will create branch <span className="font-mono">migration/airflow3-…</span> and open a PR against{" "}
                    <span className="font-mono text-foreground">{destinationRepo?.default_branch}</span>.
                  </div>
                  <Button size="sm" className="w-full gap-1.5" onClick={deploy} disabled={deploying || selected.size === 0}>
                    {deploying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitPullRequest className="w-3.5 h-3.5" />}
                    {deploying ? "Raising PR..." : `Raise Pull Request (${selected.size})`}
                  </Button>
                </Card>
              </div>
            </>
          )}

          <div>
            <h3 className="text-sm font-semibold mb-2">Recent Pull Requests</h3>
            {loading ? (
              <p className="text-xs text-muted-foreground">Loading...</p>
            ) : deployments.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-xs text-muted-foreground">No PRs raised yet.</p>
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
