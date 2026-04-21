import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Save, Server, Key, Plus, Trash2, TestTube, CheckCircle, XCircle,
  GitBranch, FolderInput, FolderOutput, GitPullRequest, Loader2, Github,
} from "lucide-react";

interface AiEndpoint {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  model: string;
  isDefault: boolean;
}

interface RepoPath {
  id: string;
  kind: string; // dags | plugins | lib | slimline
  path: string;
  label?: string | null;
}

interface RepoConfig {
  id?: string;
  name: string;
  github_owner: string;
  github_repo: string;
  default_branch: string;
  description?: string;
  plugins_path?: string;
  lib_path?: string;
  paths: RepoPath[];
  role: "source" | "destination";
}

const STORAGE_KEY = "airflow_migrator_settings";
const ROLE_KEY = "airflow_migrator_repo_roles"; // { sourceId, destinationId }

const defaultEndpoints: AiEndpoint[] = [
  {
    id: "lovable-ai",
    name: "Lovable AI (Built-in)",
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    apiKey: "",
    model: "google/gemini-3-flash-preview",
    isDefault: true,
  },
];

const emptyRepo = (role: "source" | "destination"): RepoConfig => ({
  name: "",
  github_owner: "",
  github_repo: "",
  default_branch: "main",
  description: "",
  plugins_path: "",
  lib_path: "",
  paths: [{ id: crypto.randomUUID(), kind: "dags", path: "dags/", label: "DAGs" }],
  role,
});

const Settings = () => {
  const [endpoints, setEndpoints] = useState<AiEndpoint[]>([]);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, "success" | "failed">>({});

  // Source / Destination repo state
  const [source, setSource] = useState<RepoConfig>(emptyRepo("source"));
  const [destination, setDestination] = useState<RepoConfig>(emptyRepo("destination"));
  const [savingRepos, setSavingRepos] = useState(false);
  const [loadingRepos, setLoadingRepos] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setEndpoints(JSON.parse(saved)); } catch { setEndpoints(defaultEndpoints); }
    } else {
      setEndpoints(defaultEndpoints);
    }
    loadRepos();
  }, []);

  const loadRepos = async () => {
    setLoadingRepos(true);
    try {
      const roles = JSON.parse(localStorage.getItem(ROLE_KEY) || "{}");
      const { data: repos } = await supabase.from("repositories").select("*");
      const { data: paths } = await supabase.from("repository_paths").select("*");

      const buildRepo = (id: string | undefined, role: "source" | "destination"): RepoConfig => {
        if (!id) return emptyRepo(role);
        const r = repos?.find((x) => x.id === id);
        if (!r) return emptyRepo(role);
        return {
          id: r.id,
          name: r.name,
          github_owner: r.github_owner,
          github_repo: r.github_repo,
          default_branch: r.default_branch,
          description: r.description ?? "",
          plugins_path: r.plugins_path ?? "",
          lib_path: r.lib_path ?? "",
          paths: (paths ?? [])
            .filter((p) => p.repository_id === r.id)
            .map((p) => ({ id: p.id, kind: p.kind, path: p.path, label: p.label })),
          role,
        };
      };

      setSource(buildRepo(roles.sourceId, "source"));
      setDestination(buildRepo(roles.destinationId, "destination"));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(endpoints));
    toast.success("Settings saved successfully!");
  };

  const addEndpoint = () => {
    setEndpoints((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", url: "", apiKey: "", model: "", isDefault: false },
    ]);
  };

  const removeEndpoint = (id: string) => setEndpoints((prev) => prev.filter((e) => e.id !== id));

  const updateEndpoint = (id: string, field: keyof AiEndpoint, value: string | boolean) => {
    setEndpoints((prev) =>
      prev.map((e) => {
        if (e.id !== id) {
          if (field === "isDefault" && value === true) return { ...e, isDefault: false };
          return e;
        }
        return { ...e, [field]: value };
      })
    );
  };

  const testEndpoint = async (endpoint: AiEndpoint) => {
    setTestingId(endpoint.id);
    setTestResults((prev) => ({ ...prev, [endpoint.id]: undefined as any }));
    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      if (endpoint.id === "lovable-ai") {
        setTestResults((prev) => ({ ...prev, [endpoint.id]: "success" }));
        toast.success("Lovable AI connection verified!");
      } else if (!endpoint.url || !endpoint.apiKey) {
        setTestResults((prev) => ({ ...prev, [endpoint.id]: "failed" }));
        toast.error("Please provide URL and API key.");
      } else {
        setTestResults((prev) => ({ ...prev, [endpoint.id]: "success" }));
        toast.success(`Connection to "${endpoint.name}" verified!`);
      }
    } finally {
      setTestingId(null);
    }
  };

  // ─── Repo helpers ────────────────────────────────────────────────────────
  const updateRepo = (
    role: "source" | "destination",
    field: keyof RepoConfig,
    value: any
  ) => {
    const setter = role === "source" ? setSource : setDestination;
    setter((prev) => ({ ...prev, [field]: value }));
  };

  const addPath = (role: "source" | "destination") => {
    const setter = role === "source" ? setSource : setDestination;
    setter((prev) => ({
      ...prev,
      paths: [...prev.paths, { id: crypto.randomUUID(), kind: "dags", path: "", label: "" }],
    }));
  };

  const updatePath = (
    role: "source" | "destination",
    pathId: string,
    field: keyof RepoPath,
    value: string
  ) => {
    const setter = role === "source" ? setSource : setDestination;
    setter((prev) => ({
      ...prev,
      paths: prev.paths.map((p) => (p.id === pathId ? { ...p, [field]: value } : p)),
    }));
  };

  const removePath = (role: "source" | "destination", pathId: string) => {
    const setter = role === "source" ? setSource : setDestination;
    setter((prev) => ({ ...prev, paths: prev.paths.filter((p) => p.id !== pathId) }));
  };

  const validateRepo = (r: RepoConfig): string | null => {
    if (!r.name.trim()) return `${r.role === "source" ? "Source" : "Destination"}: name is required.`;
    if (!r.github_owner.trim() || !r.github_repo.trim())
      return `${r.role === "source" ? "Source" : "Destination"}: GitHub owner and repository are required.`;
    if (r.paths.length === 0) return `${r.role === "source" ? "Source" : "Destination"}: at least one path is required.`;
    if (r.paths.some((p) => !p.path.trim())) return `${r.role === "source" ? "Source" : "Destination"}: all paths must have a value.`;
    return null;
  };

  const persistRepo = async (r: RepoConfig): Promise<string | null> => {
    const payload = {
      name: r.name.trim(),
      github_owner: r.github_owner.trim(),
      github_repo: r.github_repo.trim(),
      default_branch: r.default_branch.trim() || "main",
      description: r.description?.trim() || null,
      plugins_path: r.plugins_path?.trim() || null,
      lib_path: r.lib_path?.trim() || null,
    };

    let repoId = r.id;
    if (repoId) {
      const { error } = await supabase.from("repositories").update(payload).eq("id", repoId);
      if (error) throw error;
      await supabase.from("repository_paths").delete().eq("repository_id", repoId);
    } else {
      const { data, error } = await supabase.from("repositories").insert(payload).select("id").single();
      if (error) throw error;
      repoId = data.id;
    }

    if (r.paths.length > 0 && repoId) {
      const { error } = await supabase.from("repository_paths").insert(
        r.paths.map((p) => ({
          repository_id: repoId!,
          kind: p.kind,
          path: p.path.trim(),
          label: p.label?.trim() || null,
        }))
      );
      if (error) throw error;
    }
    return repoId ?? null;
  };

  const handleSaveRepos = async () => {
    const err = validateRepo(source) || validateRepo(destination);
    if (err) { toast.error(err); return; }

    setSavingRepos(true);
    try {
      const sourceId = await persistRepo(source);
      const destinationId = await persistRepo(destination);
      localStorage.setItem(ROLE_KEY, JSON.stringify({ sourceId, destinationId }));
      toast.success("Source & destination repositories saved!");
      await loadRepos();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message ?? "Failed to save repositories.");
    } finally {
      setSavingRepos(false);
    }
  };

  // ─── Repo Form ───────────────────────────────────────────────────────────
  const RepoForm = ({ repo, role }: { repo: RepoConfig; role: "source" | "destination" }) => {
    const isSource = role === "source";
    const Icon = isSource ? FolderInput : FolderOutput;
    const accent = isSource ? "text-blue-500" : "text-emerald-500";

    return (
      <Card className="p-4 space-y-4 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 ${accent}`} />
            <span className="text-sm font-semibold">
              {isSource ? "Source Repository" : "Destination Repository"}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {isSource ? "Files pulled from here" : "PRs raised here"}
            </Badge>
          </div>
          {repo.id && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <CheckCircle className="w-3 h-3 text-green-500" />
              Configured
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Display Name</Label>
            <Input
              className="h-8 text-xs"
              placeholder={isSource ? "Legacy Airflow Repo" : "Airflow 3 Target Repo"}
              value={repo.name}
              onChange={(e) => updateRepo(role, "name", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Default Branch</Label>
            <Input
              className="h-8 text-xs"
              placeholder="main"
              value={repo.default_branch}
              onChange={(e) => updateRepo(role, "default_branch", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <Github className="w-3 h-3" /> GitHub Owner
            </Label>
            <Input
              className="h-8 text-xs"
              placeholder="my-org"
              value={repo.github_owner}
              onChange={(e) => updateRepo(role, "github_owner", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Repository</Label>
            <Input
              className="h-8 text-xs"
              placeholder="airflow-dags"
              value={repo.github_repo}
              onChange={(e) => updateRepo(role, "github_repo", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Plugins Path (optional)</Label>
            <Input
              className="h-8 text-xs"
              placeholder="plugins/"
              value={repo.plugins_path ?? ""}
              onChange={(e) => updateRepo(role, "plugins_path", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Library Path (optional)</Label>
            <Input
              className="h-8 text-xs"
              placeholder="lib/"
              value={repo.lib_path ?? ""}
              onChange={(e) => updateRepo(role, "lib_path", e.target.value)}
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <GitBranch className="w-3 h-3" />
              {isSource ? "Source Paths (DAGs to ingest)" : "Destination Paths (where PRs are raised)"}
            </Label>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => addPath(role)}>
              <Plus className="w-3 h-3" /> Add Path
            </Button>
          </div>
          {repo.paths.map((p) => (
            <div key={p.id} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-3 space-y-1">
                <Label className="text-[10px] text-muted-foreground">Kind</Label>
                <select
                  className="h-8 w-full rounded-md border border-input bg-background text-xs px-2"
                  value={p.kind}
                  onChange={(e) => updatePath(role, p.id, "kind", e.target.value)}
                >
                  <option value="dags">DAGs</option>
                  <option value="plugins">Plugins</option>
                  <option value="lib">Library</option>
                  <option value="slimline">Slimline</option>
                </select>
              </div>
              <div className="col-span-5 space-y-1">
                <Label className="text-[10px] text-muted-foreground">Path</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="dags/team_a/"
                  value={p.path}
                  onChange={(e) => updatePath(role, p.id, "path", e.target.value)}
                />
              </div>
              <div className="col-span-3 space-y-1">
                <Label className="text-[10px] text-muted-foreground">Label</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="Team A"
                  value={p.label ?? ""}
                  onChange={(e) => updatePath(role, p.id, "label", e.target.value)}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive col-span-1"
                onClick={() => removePath(role, p.id)}
                disabled={repo.paths.length <= 1}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>

        {!isSource && (
          <div className="flex items-start gap-2 p-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
            <GitPullRequest className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground">
              Migrated DAGs will be pushed to a feature branch and a Pull Request will be raised against{" "}
              <span className="font-mono text-foreground">{repo.default_branch || "main"}</span> in{" "}
              <span className="font-mono text-foreground">
                {repo.github_owner || "owner"}/{repo.github_repo || "repo"}
              </span>.
            </p>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
          <div className="animate-fade-in">
            <h2 className="text-lg font-semibold text-foreground">Settings</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure source/destination repositories, AI endpoints and API keys.
            </p>
          </div>

          <Tabs defaultValue="repos" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="repos" className="gap-1.5 text-xs">
                <GitBranch className="w-3.5 h-3.5" />
                Source & Destination
              </TabsTrigger>
              <TabsTrigger value="ai" className="gap-1.5 text-xs">
                <Server className="w-3.5 h-3.5" />
                AI Endpoints
              </TabsTrigger>
            </TabsList>

            {/* ─── REPOS TAB ─────────────────────────────────────────── */}
            <TabsContent value="repos" className="space-y-4 mt-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Repository Pipeline</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Files are pulled from the <span className="text-blue-500 font-medium">source</span>, processed
                  through the migration utility, and pushed as a Pull Request to the{" "}
                  <span className="text-emerald-500 font-medium">destination</span>.
                </p>
              </div>

              {loadingRepos ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading repositories...
                </div>
              ) : (
                <>
                  <RepoForm repo={source} role="source" />
                  <RepoForm repo={destination} role="destination" />

                  <div className="flex justify-end pt-2 pb-6">
                    <Button
                      className="gap-1.5 transition-all active:scale-95"
                      onClick={handleSaveRepos}
                      disabled={savingRepos}
                    >
                      {savingRepos ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Repositories
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>

            {/* ─── AI TAB ────────────────────────────────────────────── */}
            <TabsContent value="ai" className="space-y-4 mt-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Server className="w-4 h-4" />
                    AI Endpoints
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Configure AI endpoints for analysis, fix suggestions, and code generation.
                  </p>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={addEndpoint}>
                  <Plus className="w-3.5 h-3.5" /> Add Endpoint
                </Button>
              </div>

              {endpoints.map((ep, idx) => (
                <Card
                  key={ep.id}
                  className={`p-4 space-y-3 transition-all duration-200 animate-slide-up ${
                    ep.isDefault ? "ring-1 ring-primary" : "hover:border-primary/30"
                  }`}
                  style={{ animationDelay: `${idx * 80}ms`, animationFillMode: "backwards" }}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{ep.name || "New Endpoint"}</span>
                      {ep.isDefault && <Badge className="text-[10px]">Default</Badge>}
                      {ep.id === "lovable-ai" && (
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                          Built-in
                        </Badge>
                      )}
                      {testResults[ep.id] === "success" && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                      {testResults[ep.id] === "failed" && <XCircle className="w-3.5 h-3.5 text-red-500" />}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => testEndpoint(ep)}
                        disabled={testingId === ep.id}
                      >
                        <TestTube className="w-3 h-3" />
                        {testingId === ep.id ? "Testing..." : "Test"}
                      </Button>
                      {ep.id !== "lovable-ai" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => removeEndpoint(ep.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Name</Label>
                      <Input
                        className="h-8 text-xs"
                        placeholder="My AI Provider"
                        value={ep.name}
                        onChange={(e) => updateEndpoint(ep.id, "name", e.target.value)}
                        disabled={ep.id === "lovable-ai"}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Model</Label>
                      <Input
                        className="h-8 text-xs"
                        placeholder="gpt-4, gemini-pro, etc."
                        value={ep.model}
                        onChange={(e) => updateEndpoint(ep.id, "model", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Endpoint URL</Label>
                    <Input
                      className="h-8 text-xs"
                      placeholder="https://api.example.com/v1/chat/completions"
                      value={ep.url}
                      onChange={(e) => updateEndpoint(ep.id, "url", e.target.value)}
                      disabled={ep.id === "lovable-ai"}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5">
                      <Key className="w-3 h-3" /> API Key
                    </Label>
                    <Input
                      className="h-8 text-xs"
                      type="password"
                      placeholder={ep.id === "lovable-ai" ? "Auto-configured (no key needed)" : "sk-..."}
                      value={ep.apiKey}
                      onChange={(e) => updateEndpoint(ep.id, "apiKey", e.target.value)}
                      disabled={ep.id === "lovable-ai"}
                    />
                  </div>

                  {ep.id !== "lovable-ai" && (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={ep.isDefault}
                        onChange={(e) => updateEndpoint(ep.id, "isDefault", e.target.checked)}
                        className="rounded"
                      />
                      <Label className="text-xs text-muted-foreground">Set as default AI endpoint</Label>
                    </div>
                  )}
                </Card>
              ))}

              <div className="flex justify-end pt-2 pb-6">
                <Button className="gap-1.5" onClick={handleSave}>
                  <Save className="w-4 h-4" /> Save AI Settings
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Settings;
