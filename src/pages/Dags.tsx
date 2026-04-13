import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Plus, AlertTriangle, Activity, Download, Play, Eye, Trash2,
  CheckCircle, XCircle, Loader2, Filter, PlayCircle, Zap,
} from "lucide-react";
import { CreateDagDialog } from "@/components/dags/CreateDagDialog";
import { DagRunsPanel } from "@/components/dags/DagRunsPanel";
import { DagCodeViewer } from "@/components/dags/DagCodeViewer";
import { ErrorCollectionResults } from "@/components/dags/ErrorCollectionResults";
import { MonitorResults } from "@/components/dags/MonitorResults";

interface DagTemplate {
  id: string;
  name: string;
  type: "error_collection" | "monitor";
  config: Record<string, any>;
  generated_code: string | null;
  created_at: string;
}

interface DagRun {
  id: string;
  template_id: string;
  status: "running" | "success" | "failed";
  logs: string | null;
  error_details: string | null;
  fix_suggestion: string | null;
  started_at: string;
  completed_at: string | null;
}

type DagStatus = "all" | "new" | "running" | "success" | "failed";

const Dags = () => {
  const [templates, setTemplates] = useState<DagTemplate[]>([]);
  const [runs, setRuns] = useState<DagRun[]>([]);
  const [collectedErrors, setCollectedErrors] = useState<any[]>([]);
  const [monitorResults, setMonitorResults] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DagTemplate | null>(null);
  const [viewingCode, setViewingCode] = useState<DagTemplate | null>(null);
  const [runningDag, setRunningDag] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<DagStatus>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchRunning, setBatchRunning] = useState(false);

  const fetchTemplates = useCallback(async () => {
    const { data } = await supabase.from("dag_templates").select("*").order("created_at", { ascending: false });
    if (data) setTemplates(data as DagTemplate[]);
  }, []);

  const fetchRuns = useCallback(async () => {
    const { data } = await supabase.from("dag_runs").select("*").order("started_at", { ascending: false });
    if (data) setRuns(data as DagRun[]);
  }, []);

  const fetchCollectedErrors = useCallback(async (templateId?: string) => {
    let query = supabase.from("dag_collected_errors").select("*").order("collected_at", { ascending: false });
    if (templateId) query = query.eq("template_id", templateId);
    const { data } = await query;
    if (data) setCollectedErrors(data);
  }, []);

  const fetchMonitorResults = useCallback(async (templateId?: string) => {
    let query = supabase.from("dag_monitor_results").select("*").order("collected_at", { ascending: false });
    if (templateId) query = query.eq("template_id", templateId);
    const { data } = await query;
    if (data) setMonitorResults(data);
  }, []);

  useEffect(() => {
    fetchTemplates();
    fetchRuns();
  }, [fetchTemplates, fetchRuns]);

  useEffect(() => {
    if (selectedTemplate) {
      if (selectedTemplate.type === "error_collection") {
        fetchCollectedErrors(selectedTemplate.id);
      } else {
        fetchMonitorResults(selectedTemplate.id);
      }
    }
  }, [selectedTemplate, fetchCollectedErrors, fetchMonitorResults]);

  // Derive status for each template
  const getDagStatus = useCallback((templateId: string): "new" | "running" | "success" | "failed" => {
    const tRuns = runs.filter((r) => r.template_id === templateId);
    if (tRuns.length === 0) return "new";
    const latest = tRuns[0];
    return latest.status;
  }, [runs]);

  const getLatestRun = useCallback((templateId: string): DagRun | undefined => {
    return runs.find((r) => r.template_id === templateId);
  }, [runs]);

  // Filter templates by status
  const filteredTemplates = templates.filter((t) => {
    if (statusFilter === "all") return true;
    return getDagStatus(t.id) === statusFilter;
  });

  const statusCounts = {
    all: templates.length,
    new: templates.filter((t) => getDagStatus(t.id) === "new").length,
    running: templates.filter((t) => getDagStatus(t.id) === "running").length,
    success: templates.filter((t) => getDagStatus(t.id) === "success").length,
    failed: templates.filter((t) => getDagStatus(t.id) === "failed").length,
  };

  const handleDelete = async (id: string) => {
    await supabase.from("dag_templates").delete().eq("id", id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    setRuns((prev) => prev.filter((r) => r.template_id !== id));
    if (selectedTemplate?.id === id) setSelectedTemplate(null);
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    toast.success("DAG template deleted.");
  };

  const handleDownload = (template: DagTemplate) => {
    if (!template.generated_code) return;
    const blob = new Blob([template.generated_code], { type: "text/x-python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${template.name.replace(/\s+/g, "_").toLowerCase()}.py`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRunDag = async (template: DagTemplate) => {
    setRunningDag(template.id);

    const { data: run, error: insertError } = await supabase
      .from("dag_runs")
      .insert({ template_id: template.id, status: "running" as const })
      .select()
      .single();

    if (insertError || !run) {
      toast.error("Failed to start DAG run.");
      setRunningDag(null);
      return;
    }

    // Update runs state immediately to show running status
    setRuns((prev) => [run as DagRun, ...prev]);

    const functionName = template.type === "monitor" ? "run-monitor-dag" : "run-error-dag";

    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { template_id: template.id, run_id: run.id, config: template.config },
      });

      if (error) throw new Error(error.message);

      await supabase
        .from("dag_runs")
        .update({
          status: (data.status || "success") as "success" | "failed",
          logs: data.logs,
          error_details: data.error_details || null,
          fix_suggestion: data.fix_suggestion || null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);

      await fetchRuns();

      if (template.type === "error_collection") {
        await fetchCollectedErrors(template.id);
      } else {
        await fetchMonitorResults(template.id);
      }

      toast.success(
        data.status === "success" || !data.status
          ? `"${template.name}" completed successfully!`
          : `"${template.name}" completed with errors.`
      );
    } catch (err: any) {
      await supabase
        .from("dag_runs")
        .update({
          status: "failed" as const,
          error_details: err.message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);
      await fetchRuns();
      toast.error(`"${template.name}" failed: ${err.message}`);
    } finally {
      setRunningDag(null);
    }
  };

  // Auto-trigger: when a new DAG is created (status "new"), auto-run it
  const handleAutoTriggerNew = async (template: DagTemplate) => {
    toast.info(`Auto-triggering "${template.name}"...`);
    await handleRunDag(template);
  };

  // Batch run selected DAGs
  const handleBatchRun = async () => {
    const toRun = templates.filter((t) => selectedIds.has(t.id));
    if (toRun.length === 0) { toast.error("No DAGs selected."); return; }
    setBatchRunning(true);
    toast.info(`Running ${toRun.length} DAG(s)...`);
    for (const t of toRun) {
      await handleRunDag(t);
    }
    setSelectedIds(new Set());
    setBatchRunning(false);
    toast.success("Batch run completed.");
  };

  // Run all new DAGs
  const handleRunAllNew = async () => {
    const newDags = templates.filter((t) => getDagStatus(t.id) === "new");
    if (newDags.length === 0) { toast.info("No new DAGs to run."); return; }
    setBatchRunning(true);
    toast.info(`Auto-triggering ${newDags.length} new DAG(s)...`);
    for (const t of newDags) {
      await handleRunDag(t);
    }
    setBatchRunning(false);
    toast.success("All new DAGs triggered.");
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTemplates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTemplates.map((t) => t.id)));
    }
  };

  const templateRuns = selectedTemplate ? runs.filter((r) => r.template_id === selectedTemplate.id) : [];

  const statusBadgeConfig: Record<string, { label: string; variant: string; icon: React.ReactNode }> = {
    new: { label: "New", variant: "outline", icon: <Zap className="w-3 h-3 text-yellow-500" /> },
    running: { label: "Running", variant: "secondary", icon: <Loader2 className="w-3 h-3 text-primary animate-spin" /> },
    success: { label: "Success", variant: "default", icon: <CheckCircle className="w-3 h-3 text-green-500" /> },
    failed: { label: "Failed", variant: "destructive", icon: <XCircle className="w-3 h-3 text-red-500" /> },
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />

      <div className="flex-1 flex overflow-hidden">
        {/* Left: DAG templates list */}
        <div className="w-80 border-r border-border flex flex-col shrink-0">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">DAG Templates</h2>
              <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" />
                Add DAG
              </Button>
            </div>

            {/* Status filter tabs */}
            <div className="flex flex-wrap gap-1">
              {(["all", "new", "running", "failed", "success"] as DagStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setSelectedIds(new Set()); }}
                  className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                    statusFilter === s
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 text-muted-foreground border-border hover:bg-accent"
                  }`}
                >
                  {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)} ({statusCounts[s]})
                </button>
              ))}
            </div>

            {/* Batch actions */}
            {filteredTemplates.length > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <Checkbox
                  checked={selectedIds.size === filteredTemplates.length && filteredTemplates.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-[10px] text-muted-foreground">
                  {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all"}
                </span>
                {selectedIds.size > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] gap-1 ml-auto"
                    onClick={handleBatchRun}
                    disabled={batchRunning}
                  >
                    {batchRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <PlayCircle className="w-3 h-3" />}
                    Run Selected
                  </Button>
                )}
                {statusCounts.new > 0 && selectedIds.size === 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] gap-1 ml-auto"
                    onClick={handleRunAllNew}
                    disabled={batchRunning}
                  >
                    <Zap className="w-3 h-3" />
                    Auto-Run New ({statusCounts.new})
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {filteredTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm p-4 text-center">
                <p>{statusFilter === "all" ? 'No DAG templates yet.' : `No ${statusFilter} DAGs.`}</p>
                <p className="text-xs mt-1">
                  {statusFilter === "all" ? 'Click "Add DAG" to create one.' : "Try a different filter."}
                </p>
              </div>
            ) : (
              filteredTemplates.map((t) => {
                const status = getDagStatus(t.id);
                const latestRun = getLatestRun(t.id);
                const cfg = statusBadgeConfig[status];
                const isSelected = selectedIds.has(t.id);

                return (
                  <Card
                    key={t.id}
                    className={`p-3 cursor-pointer hover:bg-accent/50 transition-colors ${
                      selectedTemplate?.id === t.id ? "ring-1 ring-primary bg-accent/30" : ""
                    }`}
                    onClick={() => setSelectedTemplate(t)}
                  >
                    <div className="flex items-start gap-2">
                      <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(t.id)}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {t.type === "error_collection" ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                          ) : (
                            <Activity className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          )}
                          <span className="text-xs font-medium truncate">{t.name}</span>
                          <div className="flex items-center gap-1 ml-auto shrink-0">
                            {cfg.icon}
                            <Badge variant={cfg.variant as any} className="text-[9px] h-4">
                              {cfg.label}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                          <Badge variant="outline" className="text-[9px] h-4">
                            {t.type === "error_collection" ? "Error" : "Monitor"}
                          </Badge>
                          {latestRun ? (
                            <span>Last: {new Date(latestRun.started_at).toLocaleString()}</span>
                          ) : (
                            <span>Never run</span>
                          )}
                        </div>
                        {latestRun?.completed_at && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Duration: {Math.round((new Date(latestRun.completed_at).getTime() - new Date(latestRun.started_at).getTime()) / 1000)}s
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Details panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedTemplate ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Template header */}
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    {selectedTemplate.type === "error_collection" ? (
                      <AlertTriangle className="w-5 h-5 text-orange-500" />
                    ) : (
                      <Activity className="w-5 h-5 text-blue-500" />
                    )}
                    {selectedTemplate.name}
                    <Badge variant={statusBadgeConfig[getDagStatus(selectedTemplate.id)].variant as any} className="text-[10px] ml-1">
                      {statusBadgeConfig[getDagStatus(selectedTemplate.id)].label}
                    </Badge>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    ID: <span className="font-mono">{selectedTemplate.id.slice(0, 8)}</span>
                    {" · "}
                    {selectedTemplate.type === "error_collection"
                      ? "Collects and stores Airflow errors"
                      : "Monitors DAG execution and reports status"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getDagStatus(selectedTemplate.id) === "new" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs bg-yellow-500/10 border-yellow-500/30 text-yellow-600 hover:bg-yellow-500/20"
                      onClick={() => handleAutoTriggerNew(selectedTemplate)}
                      disabled={runningDag === selectedTemplate.id}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Auto-Trigger
                    </Button>
                  )}
                  {selectedTemplate.generated_code && (
                    <>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setViewingCode(selectedTemplate)}>
                        <Eye className="w-3.5 h-3.5" />
                        View Code
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => handleDownload(selectedTemplate)}>
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => handleRunDag(selectedTemplate)}
                    disabled={runningDag === selectedTemplate.id}
                  >
                    {runningDag === selectedTemplate.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    Run DAG
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(selectedTemplate.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="results" className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="mx-4 mt-2 w-fit">
                  <TabsTrigger value="results" className="text-xs">
                    {selectedTemplate.type === "error_collection" ? "Collected Errors" : "Monitor Results"}
                  </TabsTrigger>
                  <TabsTrigger value="history" className="text-xs">Run History</TabsTrigger>
                  <TabsTrigger value="config" className="text-xs">Configuration</TabsTrigger>
                </TabsList>

                <TabsContent value="results" className="flex-1 flex flex-col overflow-hidden mt-0">
                  {selectedTemplate.type === "error_collection" ? (
                    <ErrorCollectionResults errors={collectedErrors} />
                  ) : (
                    <MonitorResults results={monitorResults} />
                  )}
                </TabsContent>

                <TabsContent value="history" className="flex-1 flex flex-col overflow-hidden mt-0">
                  <DagRunsPanel runs={templateRuns} templateType={selectedTemplate.type} />
                </TabsContent>

                <TabsContent value="config" className="mt-0 p-4">
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2">CONFIGURATION</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(selectedTemplate.config).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}:</span>
                        <span className="font-medium">{Array.isArray(value) ? value.join(", ") : String(value)}</span>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <Activity className="w-12 h-12 text-primary/30 mb-4" />
              <p className="text-sm">Select a DAG template or create a new one.</p>
            </div>
          )}
        </div>
      </div>

      <CreateDagDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={(template) => {
          setTemplates((prev) => [template as DagTemplate, ...prev]);
          setSelectedTemplate(template as DagTemplate);
          toast.success("DAG template created!");
        }}
      />

      {viewingCode && (
        <DagCodeViewer
          code={viewingCode.generated_code || ""}
          name={viewingCode.name}
          onClose={() => setViewingCode(null)}
        />
      )}
    </div>
  );
};

export default Dags;
