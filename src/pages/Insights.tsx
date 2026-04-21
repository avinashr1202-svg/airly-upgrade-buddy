import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, FileCode, Layers, ArrowRightLeft, Ruler, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Repo { id: string; name: string; github_owner: string; github_repo: string; }
interface RepoInsight { id: string; repository_id: string | null; category: string; title: string; detail: string | null; occurrences: number | null; }
interface FileInsight {
  id: string; file_id: string; repository_id: string;
  airflow3_ready: boolean | null; python313_ready: boolean | null;
  structure_summary: string | null; analysis_notes: string | null;
  required_changes: any;
}
interface IngestedFile { id: string; file_name: string; file_path: string; kind: string; }

const Insights = () => {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selected, setSelected] = useState<string>("all");
  const [repoInsights, setRepoInsights] = useState<RepoInsight[]>([]);
  const [fileInsights, setFileInsights] = useState<FileInsight[]>([]);
  const [files, setFiles] = useState<IngestedFile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [r, ri, fi, f] = await Promise.all([
      supabase.from("repositories").select("id,name,github_owner,github_repo"),
      supabase.from("repo_insights").select("*").order("category"),
      supabase.from("file_insights").select("*"),
      supabase.from("ingested_files").select("id,file_name,file_path,kind"),
    ]);
    setRepos((r.data as Repo[]) ?? []);
    setRepoInsights((ri.data as RepoInsight[]) ?? []);
    setFileInsights((fi.data as FileInsight[]) ?? []);
    setFiles((f.data as IngestedFile[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filteredRepoInsights = selected === "all" ? repoInsights : repoInsights.filter(i => i.repository_id === selected);
  const filteredFileInsights = selected === "all" ? fileInsights : fileInsights.filter(i => i.repository_id === selected);

  const byCategory = (cat: string) => filteredRepoInsights.filter(i => i.category === cat);
  const fileById = (id: string) => files.find(f => f.id === id);

  const stats = {
    total: filteredFileInsights.length,
    af3Ready: filteredFileInsights.filter(f => f.airflow3_ready).length,
    py313Ready: filteredFileInsights.filter(f => f.python313_ready).length,
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
          <div className="flex items-start justify-between gap-3 flex-wrap animate-fade-in">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Brain className="w-4 h-4" /> AI Insights
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Aggregated AI analysis: code patterns, migration rules, standards & per-file readiness.
              </p>
            </div>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="w-[240px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Repositories</SelectItem>
                {repos.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading insights...
            </div>
          ) : repoInsights.length === 0 && fileInsights.length === 0 ? (
            <Card className="p-8 text-center">
              <Brain className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">No insights yet</p>
              <p className="text-xs text-muted-foreground mt-1">Register a repository and run ingestion to see AI insights.</p>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-4">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Files Analyzed</p>
                  <p className="text-2xl font-bold mt-1">{stats.total}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Airflow 3.x Ready</p>
                  <p className="text-2xl font-bold mt-1 text-green-600">{stats.af3Ready}<span className="text-sm text-muted-foreground font-normal">/{stats.total}</span></p>
                </Card>
                <Card className="p-4">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Python 3.13 Ready</p>
                  <p className="text-2xl font-bold mt-1 text-green-600">{stats.py313Ready}<span className="text-sm text-muted-foreground font-normal">/{stats.total}</span></p>
                </Card>
              </div>

              <Tabs defaultValue="patterns">
                <TabsList>
                  <TabsTrigger value="patterns" className="text-xs gap-1.5"><Layers className="w-3.5 h-3.5" />Patterns</TabsTrigger>
                  <TabsTrigger value="rules" className="text-xs gap-1.5"><ArrowRightLeft className="w-3.5 h-3.5" />Migration Rules</TabsTrigger>
                  <TabsTrigger value="standards" className="text-xs gap-1.5"><Ruler className="w-3.5 h-3.5" />Standards</TabsTrigger>
                  <TabsTrigger value="files" className="text-xs gap-1.5"><FileCode className="w-3.5 h-3.5" />Per-File</TabsTrigger>
                </TabsList>

                {(["pattern", "migration_rule", "standard"] as const).map((cat, idx) => (
                  <TabsContent key={cat} value={["patterns", "rules", "standards"][idx]} className="space-y-2 mt-3">
                    {byCategory(cat).length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">No {cat.replace("_", " ")} insights yet.</p>
                    ) : byCategory(cat).map(i => (
                      <Card key={i.id} className="p-3 hover:border-primary/30 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{i.title}</p>
                            {i.detail && <p className="text-xs text-muted-foreground mt-1">{i.detail}</p>}
                          </div>
                          {i.occurrences != null && <Badge variant="outline" className="text-[10px]">{i.occurrences}×</Badge>}
                        </div>
                      </Card>
                    ))}
                  </TabsContent>
                ))}

                <TabsContent value="files" className="space-y-2 mt-3">
                  {filteredFileInsights.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">No file-level insights yet.</p>
                  ) : filteredFileInsights.map(fi => {
                    const f = fileById(fi.file_id);
                    return (
                      <Card key={fi.id} className="p-3">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium font-mono">{f?.file_path ?? "unknown"}</p>
                              <Badge variant="outline" className="text-[10px]">{f?.kind}</Badge>
                              {fi.airflow3_ready
                                ? <Badge className="text-[10px] bg-green-500/15 text-green-600 border-green-500/30 gap-1"><CheckCircle2 className="w-3 h-3" />AF 3.x</Badge>
                                : <Badge variant="outline" className="text-[10px] gap-1 text-amber-600 border-amber-500/30"><XCircle className="w-3 h-3" />AF 3.x</Badge>}
                              {fi.python313_ready
                                ? <Badge className="text-[10px] bg-green-500/15 text-green-600 border-green-500/30 gap-1"><CheckCircle2 className="w-3 h-3" />Py 3.13</Badge>
                                : <Badge variant="outline" className="text-[10px] gap-1 text-amber-600 border-amber-500/30"><XCircle className="w-3 h-3" />Py 3.13</Badge>}
                            </div>
                            {fi.structure_summary && <p className="text-xs text-muted-foreground mt-1.5">{fi.structure_summary}</p>}
                            {fi.analysis_notes && <p className="text-[11px] text-amber-600/90 mt-1">⚠ {fi.analysis_notes}</p>}
                            {Array.isArray(fi.required_changes) && fi.required_changes.length > 0 && (
                              <ul className="text-[11px] text-muted-foreground mt-1.5 list-disc list-inside space-y-0.5">
                                {fi.required_changes.slice(0, 3).map((c: string, i: number) => <li key={i}>{c}</li>)}
                              </ul>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Insights;
