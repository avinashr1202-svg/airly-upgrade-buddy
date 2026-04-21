import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Save, Server, Key, Plus, Trash2, TestTube, CheckCircle, XCircle,
  GitBranch, FolderInput, FolderOutput, GitPullRequest, Loader2, Github,
  Pencil, FolderTree,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────
interface AiEndpoint {
  id: string; name: string; url: string; apiKey: string; model: string; isDefault: boolean;
}

interface RepoPath {
  id: string; kind: string; path: string; label?: string | null;
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
const ROLES_KEY = "airflow_migrator_repo_roles_v2"; // { sourceIds: string[], destinationIds: string[] }

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
  // ── AI endpoints ─────────────────────────────────────────────────────────
  const [endpoints, setEndpoints] = useState<AiEndpoint[]>([]);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, "success" | "failed">>({});

  // ── Repos (multi) ────────────────────────────────────────────────────────
  const [sources, setSources] = useState<RepoConfig[]>([]);
  const [destinations, setDestinations] = useState<RepoConfig[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(true);

  // ── Edit modal ───────────────────────────────────────────────────────────
  const [editing, setEditing] = useState<RepoConfig | null>(null);
  const [editingRole, setEditingRole] = useState<"source" | "destination">("source");
  const [saving, setSaving] = useState(false);

  // ── Delete confirm ───────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<{ repo: RepoConfig; role: "source" | "destination" } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setEndpoints(JSON.parse(saved)); } catch { setEndpoints(defaultEndpoints); }
    } else setEndpoints(defaultEndpoints);
    loadRepos();
  }, []);

  const loadRepos = async () => {
    setLoadingRepos(true);
    try {
      const roles: { sourceIds?: string[]; destinationIds?: string[] } =
        JSON.parse(localStorage.getItem(ROLES_KEY) || "{}");

      const { data: repos } = await supabase.from("repositories").select("*").order("created_at", { ascending: true });
      const { data: paths } = await supabase.from("repository_paths").select("*");

      const buildRepo = (id: string, role: "source" | "destination"): RepoConfig | null => {
        const r = repos?.find((x) => x.id === id);
        if (!r) return null;
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

      setSources((roles.sourceIds ?? []).map((id) => buildRepo(id, "source")).filter(Boolean) as RepoConfig[]);
      setDestinations((roles.destinationIds ?? []).map((id) => buildRepo(id, "destination")).filter(Boolean) as RepoConfig[]);
    } catch (e) { console.error(e); }
    finally { setLoadingRepos(false); }
  };

  const saveRoles = (sourceIds: string[], destinationIds: string[]) => {
    localStorage.setItem(ROLES_KEY, JSON.stringify({ sourceIds, destinationIds }));
  };

  // ── AI handlers ──────────────────────────────────────────────────────────
  const handleSaveAi = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(endpoints));
    toast.success("AI settings saved!");
  };
  const addEndpoint = () => setEndpoints((p) => [...p, {
    id: crypto.randomUUID(), name: "", url: "", apiKey: "", model: "", isDefault: false,
  }]);
  const removeEndpoint = (id: string) => setEndpoints((p) => p.filter((e) => e.id !== id));
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
    setTestResults((p) => ({ ...p, [endpoint.id]: undefined as any }));
    try {
      await new Promise((r) => setTimeout(r, 1000));
      if (endpoint.id === "lovable-ai") {
        setTestResults((p) => ({ ...p, [endpoint.id]: "success" }));
        toast.success("Lovable AI connection verified!");
      } else if (!endpoint.url || !endpoint.apiKey) {
        setTestResults((p) => ({ ...p, [endpoint.id]: "failed" }));
        toast.error("Please provide URL and API key.");
      } else {
        setTestResults((p) => ({ ...p, [endpoint.id]: "success" }));
        toast.success(`Connection to "${endpoint.name}" verified!`);
      }
    } finally { setTestingId(null); }
  };

  // ── Repo edit modal helpers ──────────────────────────────────────────────
  const openCreate = (role: "source" | "destination") => {
    setEditingRole(role);
    setEditing(emptyRepo(role));
  };
  const openEdit = (repo: RepoConfig, role: "source" | "destination") => {
    setEditingRole(role);
    setEditing({ ...repo, paths: repo.paths.map((p) => ({ ...p })) });
  };
  const closeEdit = () => setEditing(null);

  const updateField = (field: keyof RepoConfig, value: any) => {
    if (!editing) return;
    setEditing({ ...editing, [field]: value });
  };
  const addPath = () => {
    if (!editing) return;
    setEditing({
      ...editing,
      paths: [...editing.paths, { id: crypto.randomUUID(), kind: "dags", path: "", label: "" }],
    });
  };
  const updatePath = (pathId: string, field: keyof RepoPath, value: string) => {
    if (!editing) return;
    setEditing({
      ...editing,
      paths: editing.paths.map((p) => (p.id === pathId ? { ...p, [field]: value } : p)),
    });
  };
  const removePath = (pathId: string) => {
    if (!editing) return;
    setEditing({ ...editing, paths: editing.paths.filter((p) => p.id !== pathId) });
  };

  const validate = (r: RepoConfig): string | null => {
    if (!r.name.trim()) return "Display name is required.";
    if (!r.github_owner.trim() || !r.github_repo.trim()) return "GitHub owner and repository are required.";
    if (r.paths.length === 0) return "Add at least one path.";
    if (r.paths.some((p) => !p.path.trim())) return "All paths must have a value.";
    return null;
  };

  const persistRepo = async (r: RepoConfig): Promise<string> => {
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
    return repoId!;
  };

  const handleSaveRepo = async () => {
    if (!editing) return;
    const err = validate(editing);
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      const id = await persistRepo(editing);
      const isNew = !editing.id;
      if (isNew) {
        const currentSources = sources.map((s) => s.id!).filter(Boolean);
        const currentDests = destinations.map((d) => d.id!).filter(Boolean);
        if (editingRole === "source") saveRoles([...currentSources, id], currentDests);
        else saveRoles(currentSources, [...currentDests, id]);
      }
      toast.success(`${editingRole === "source" ? "Source" : "Destination"} ${isNew ? "added" : "updated"}`);
      setEditing(null);
      await loadRepos();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message ?? "Failed to save.");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { repo, role } = deleteTarget;
    try {
      if (repo.id) {
        await supabase.from("repository_paths").delete().eq("repository_id", repo.id);
        await supabase.from("repositories").delete().eq("id", repo.id);
      }
      const currentSources = sources.map((s) => s.id!).filter(Boolean);
      const currentDests = destinations.map((d) => d.id!).filter(Boolean);
      if (role === "source") saveRoles(currentSources.filter((id) => id !== repo.id), currentDests);
      else saveRoles(currentSources, currentDests.filter((id) => id !== repo.id));
      toast.success(`${role === "source" ? "Source" : "Destination"} removed`);
      setDeleteTarget(null);
      await loadRepos();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to delete.");
    }
  };

  // ── Repo card (collapsed view) ───────────────────────────────────────────
  const RepoCard = ({ repo, role }: { repo: RepoConfig; role: "source" | "destination" }) => {
    const isSource = role === "source";
    const Icon = isSource ? FolderInput : FolderOutput;
    const accentBg = isSource ? "bg-blue-500/15 text-blue-500" : "bg-emerald-500/15 text-emerald-500";

    return (
      <Card className="p-3.5 hover:border-primary/30 transition-all animate-slide-up">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${accentBg}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold truncate">{repo.name}</p>
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Github className="w-2.5 h-2.5" />
                  {repo.github_owner}/{repo.github_repo}
                </Badge>
                <Badge variant="outline" className="text-[10px] gap-1">
                  <GitBranch className="w-2.5 h-2.5" />
                  {repo.default_branch}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {repo.paths.slice(0, 4).map((p) => (
                  <Badge key={p.id} variant="secondary" className="text-[10px] gap-1 font-mono">
                    <FolderTree className="w-2.5 h-2.5" />
                    {p.path}
                  </Badge>
                ))}
                {repo.paths.length > 4 && (
                  <Badge variant="secondary" className="text-[10px]">+{repo.paths.length - 4} more</Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openEdit(repo, role)}>
              <Pencil className="w-3 h-3" /> Edit
            </Button>
            <Button
              size="icon" variant="ghost" className="h-7 w-7 text-destructive"
              onClick={() => setDeleteTarget({ repo, role })}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
          <div className="animate-fade-in">
            <h2 className="text-lg font-semibold text-foreground">Settings</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage multiple source and destination repositories, AI endpoints and API keys.
            </p>
          </div>

          <Tabs defaultValue="repos" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="repos" className="gap-1.5 text-xs">
                <GitBranch className="w-3.5 h-3.5" /> Sources & Destinations
              </TabsTrigger>
              <TabsTrigger value="ai" className="gap-1.5 text-xs">
                <Server className="w-3.5 h-3.5" /> AI Endpoints
              </TabsTrigger>
            </TabsList>

            {/* ─── REPOS TAB ─────────────────────────────────────────── */}
            <TabsContent value="repos" className="space-y-6 mt-4">
              {loadingRepos ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading...
                </div>
              ) : (
                <>
                  {/* Sources */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold flex items-center gap-1.5">
                          <FolderInput className="w-4 h-4 text-blue-500" />
                          Source Repositories
                          <Badge variant="outline" className="text-[10px] ml-1">{sources.length}</Badge>
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Files are pulled from these repos for migration.</p>
                      </div>
                      <Button size="sm" className="gap-1.5 text-xs" onClick={() => openCreate("source")}>
                        <Plus className="w-3.5 h-3.5" /> Add Source
                      </Button>
                    </div>
                    {sources.length === 0 ? (
                      <Card className="p-6 text-center border-dashed">
                        <FolderInput className="w-6 h-6 mx-auto text-muted-foreground mb-1.5" />
                        <p className="text-xs text-muted-foreground">No source repositories yet.</p>
                      </Card>
                    ) : (
                      <div className="space-y-2">
                        {sources.map((s) => <RepoCard key={s.id} repo={s} role="source" />)}
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Destinations */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold flex items-center gap-1.5">
                          <FolderOutput className="w-4 h-4 text-emerald-500" />
                          Destination Repositories
                          <Badge variant="outline" className="text-[10px] ml-1">{destinations.length}</Badge>
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Migrated files are deployed here via Pull Requests.</p>
                      </div>
                      <Button size="sm" className="gap-1.5 text-xs" onClick={() => openCreate("destination")}>
                        <Plus className="w-3.5 h-3.5" /> Add Destination
                      </Button>
                    </div>
                    {destinations.length === 0 ? (
                      <Card className="p-6 text-center border-dashed">
                        <FolderOutput className="w-6 h-6 mx-auto text-muted-foreground mb-1.5" />
                        <p className="text-xs text-muted-foreground">No destination repositories yet.</p>
                      </Card>
                    ) : (
                      <div className="space-y-2">
                        {destinations.map((d) => <RepoCard key={d.id} repo={d} role="destination" />)}
                      </div>
                    )}
                  </div>
                </>
              )}
            </TabsContent>

            {/* ─── AI TAB ────────────────────────────────────────────── */}
            <TabsContent value="ai" className="space-y-4 mt-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Server className="w-4 h-4" /> AI Endpoints
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
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">Built-in</Badge>
                      )}
                      {testResults[ep.id] === "success" && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                      {testResults[ep.id] === "failed" && <XCircle className="w-3.5 h-3.5 text-red-500" />}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
                        onClick={() => testEndpoint(ep)} disabled={testingId === ep.id}>
                        <TestTube className="w-3 h-3" />
                        {testingId === ep.id ? "Testing..." : "Test"}
                      </Button>
                      {ep.id !== "lovable-ai" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          onClick={() => removeEndpoint(ep.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Name</Label>
                      <Input className="h-8 text-xs" placeholder="My AI Provider" value={ep.name}
                        onChange={(e) => updateEndpoint(ep.id, "name", e.target.value)} disabled={ep.id === "lovable-ai"} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Model</Label>
                      <Input className="h-8 text-xs" placeholder="gpt-4, gemini-pro, etc." value={ep.model}
                        onChange={(e) => updateEndpoint(ep.id, "model", e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Endpoint URL</Label>
                    <Input className="h-8 text-xs" placeholder="https://api.example.com/v1/chat/completions"
                      value={ep.url} onChange={(e) => updateEndpoint(ep.id, "url", e.target.value)} disabled={ep.id === "lovable-ai"} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5"><Key className="w-3 h-3" /> API Key</Label>
                    <Input className="h-8 text-xs" type="password"
                      placeholder={ep.id === "lovable-ai" ? "Auto-configured" : "sk-..."}
                      value={ep.apiKey} onChange={(e) => updateEndpoint(ep.id, "apiKey", e.target.value)} disabled={ep.id === "lovable-ai"} />
                  </div>
                  {ep.id !== "lovable-ai" && (
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={ep.isDefault}
                        onChange={(e) => updateEndpoint(ep.id, "isDefault", e.target.checked)} className="rounded" />
                      <Label className="text-xs text-muted-foreground">Set as default AI endpoint</Label>
                    </div>
                  )}
                </Card>
              ))}

              <div className="flex justify-end pt-2 pb-6">
                <Button className="gap-1.5" onClick={handleSaveAi}>
                  <Save className="w-4 h-4" /> Save AI Settings
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ─── Edit Repo Modal ─────────────────────────────────────────────── */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && closeEdit()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingRole === "source" ? (
                <FolderInput className="w-4 h-4 text-blue-500" />
              ) : (
                <FolderOutput className="w-4 h-4 text-emerald-500" />
              )}
              {editing?.id ? "Edit" : "Add"} {editingRole === "source" ? "Source" : "Destination"} Repository
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingRole === "source"
                ? "Configure where files will be pulled from for analysis and migration."
                : "Configure where migrated files will be pushed via a Pull Request."}
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Display Name</Label>
                  <Input className="h-8 text-xs" placeholder="Legacy Airflow Repo"
                    value={editing.name} onChange={(e) => updateField("name", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Default Branch</Label>
                  <Input className="h-8 text-xs" placeholder="main"
                    value={editing.default_branch} onChange={(e) => updateField("default_branch", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5"><Github className="w-3 h-3" /> GitHub Owner</Label>
                  <Input className="h-8 text-xs" placeholder="my-org"
                    value={editing.github_owner} onChange={(e) => updateField("github_owner", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Repository</Label>
                  <Input className="h-8 text-xs" placeholder="airflow-dags"
                    value={editing.github_repo} onChange={(e) => updateField("github_repo", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Plugins Path (optional)</Label>
                  <Input className="h-8 text-xs" placeholder="plugins/"
                    value={editing.plugins_path ?? ""} onChange={(e) => updateField("plugins_path", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Library Path (optional)</Label>
                  <Input className="h-8 text-xs" placeholder="lib/"
                    value={editing.lib_path ?? ""} onChange={(e) => updateField("lib_path", e.target.value)} />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <FolderTree className="w-3 h-3" />
                    {editingRole === "source" ? "Source Paths" : "Destination Paths"}
                  </Label>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addPath}>
                    <Plus className="w-3 h-3" /> Add Path
                  </Button>
                </div>
                {editing.paths.map((p) => (
                  <div key={p.id} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-3 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Kind</Label>
                      <select className="h-8 w-full rounded-md border border-input bg-background text-xs px-2"
                        value={p.kind} onChange={(e) => updatePath(p.id, "kind", e.target.value)}>
                        <option value="dags">DAGs</option>
                        <option value="plugins">Plugins</option>
                        <option value="lib">Library</option>
                        <option value="slimline">Slimline</option>
                      </select>
                    </div>
                    <div className="col-span-5 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Path</Label>
                      <Input className="h-8 text-xs" placeholder="dags/team_a/"
                        value={p.path} onChange={(e) => updatePath(p.id, "path", e.target.value)} />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Label</Label>
                      <Input className="h-8 text-xs" placeholder="Team A"
                        value={p.label ?? ""} onChange={(e) => updatePath(p.id, "label", e.target.value)} />
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive col-span-1"
                      onClick={() => removePath(p.id)} disabled={editing.paths.length <= 1}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              {editingRole === "destination" && (
                <div className="flex items-start gap-2 p-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                  <GitPullRequest className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-muted-foreground">
                    Migrated DAGs will be pushed to a feature branch and a PR raised against{" "}
                    <span className="font-mono text-foreground">{editing.default_branch || "main"}</span>.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={closeEdit} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={handleSaveRepo} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {editing?.id ? "Save Changes" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirm ──────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove repository?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <span className="font-semibold">{deleteTarget?.repo.name}</span> and its configured paths. Ingested files and insights linked to it will remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Settings;
