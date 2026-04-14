import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, AlertTriangle, Activity, Download, Play, Eye, Trash2, CheckCircle, XCircle, Loader2, Filter, ArrowLeft } from "lucide-react";
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

type ListFilter = "all" | "error_collection" | "monitor";

const Dags = () => {
  const [templates, setTemplates] = useState<DagTemplate[]>([]);
  const [runs, setRuns] = useState<DagRun[]>([]);
  const [collectedErrors, setCollectedErrors] = useState<any[]>([]);
  const [monitorResults, setMonitorResults] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DagTemplate | null>(null);
  const [viewingCode, setViewingCode] = useState<DagTemplate | null>(null);
  const [runningDag, setRunningDag] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState<ListFilter>("all");

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

  const handleDelete = async (id: string) => {
    await supabase.from("dag_templates").delete().eq("id", id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    setRuns((prev) => prev.filter((r) => r.template_id !== id));
    if (selectedTemplate?.id === id) setSelectedTemplate(null);
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
          ? "DAG run completed successfully!"
          : "DAG run completed with errors. Check results."
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
      toast.error("DAG run failed: " + err.message);
    } finally {
      setRunningDag(null);
    }
  };

  const getLastRunStatus = (templateId: string): DagRun | undefined => {
    return runs.find((r) => r.template_id === templateId);
  };

  const filteredTemplates = templates.filter((t) => listFilter === "all" || t.type === listFilter);
  const templateRuns = selectedTemplate ? runs.filter((r) => r.template_id === selectedTemplate.id) : [];

  const displayConfig = (config: Record<string, any>) => {
    const entries = Object.entries(config).filter(([key]) => key !== "airflow_connection");
    return entries;
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />

      <div className="flex-1 flex overflow-hidden">
        {/* Left: DAG templates list */}
        <div className={`
          ${selectedTemplate ? 'hidden md:flex' : 'flex'}
          w-full md:w-80 lg:w-96 border-r border-border flex-col shrink-0
        `}>
          <div className="p-3 md:p-4 border-b border-border space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">DAG Templates</h2>
              <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5 text-xs transition-all duration-200 active:scale-95">
                <Plus className="w-3.5 h-3.5" />
                Add DAG
              </Button>
            </div>
            <Select value={listFilter} onValueChange={(v) => setListFilter(v as ListFilter)}>
              <SelectTrigger className="h-7 text-xs">
                <Filter className="w-3 h-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types ({templates.length})</SelectItem>
                <SelectItem value="error_collection">Error Collection ({templates.filter(t => t.type === "error_collection").length})</SelectItem>
                <SelectItem value="monitor">Monitor ({templates.filter(t => t.type === "monitor").length})</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin">
            {filteredTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm p-4 text-center animate-fade-in">
                <Activity className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p>No DAG templates yet.</p>
                <p className="text-xs mt-1">Click "Add DAG" to create one.</p>
              </div>
            ) : (
              filteredTemplates.map((t, idx) => {
                const lastRun = getLastRunStatus(t.id);
                return (
                  <Card
                    key={t.id}
                    className={`p-3 cursor-pointer hover:bg-accent/50 transition-all duration-200 animate-slide-up ${
                      selectedTemplate?.id === t.id ? "ring-1 ring-primary bg-accent/30" : ""
                    }`}
                    style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'backwards' }}
                    onClick={() => setSelectedTemplate(t)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {t.type === "error_collection" ? (
                          <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
                        ) : (
                          <Activity className="w-4 h-4 text-blue-500 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{t.name}</p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">
                              {t.type === "error_collection" ? "Error Collection" : "Monitor"}
                            </Badge>
                            {lastRun && (
                              <Badge
                                variant={lastRun.status === "success" ? "default" : lastRun.status === "failed" ? "destructive" : "secondary"}
                                className="text-[10px]"
                              >
                                {lastRun.status}
                              </Badge>
                            )}
                          </div>
                          {lastRun && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Last: {new Date(lastRun.started_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {lastRun && (
                          lastRun.status === "success" ? (
                            <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                          ) : lastRun.status === "failed" ? (
                            <XCircle className="w-3.5 h-3.5 text-red-500" />
                          ) : (
                            <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                          )
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
        <div className={`
          ${selectedTemplate ? 'flex' : 'hidden md:flex'}
          flex-1 flex-col min-w-0
        `}>
          {selectedTemplate ? (
            <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
              <div className="p-3 md:p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {/* Mobile back */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden h-8 w-8 shrink-0"
                    onClick={() => setSelectedTemplate(null)}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <div>
                    <h3 className="text-base md:text-lg font-semibold flex items-center gap-2">
                      {selectedTemplate.type === "error_collection" ? (
                        <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-orange-500" />
                      ) : (
                        <Activity className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
                      )}
                      <span className="truncate">{selectedTemplate.name}</span>
                    </h3>
                    <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">
                      {selectedTemplate.type === "error_collection"
                        ? "Collects and stores Airflow errors"
                        : "Monitors DAG execution and reports status"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap ml-10 md:ml-0">
                  {selectedTemplate.generated_code && (
                    <>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs transition-all active:scale-95" onClick={() => setViewingCode(selectedTemplate)}>
                        <Eye className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">View Code</span>
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs transition-all active:scale-95" onClick={() => handleDownload(selectedTemplate)}>
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Download</span>
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs transition-all active:scale-95"
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
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive transition-all active:scale-95" onClick={() => handleDelete(selectedTemplate.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <Tabs defaultValue="results" className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="mx-3 md:mx-4 mt-2 w-fit">
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

                <TabsContent value="config" className="mt-0 p-3 md:p-4 space-y-4 overflow-y-auto">
                  {(selectedTemplate.config as any)?.airflow_connection && (
                    <div className="animate-slide-up">
                      <h4 className="text-xs font-semibold text-muted-foreground mb-2">AIRFLOW CONNECTION</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs p-3 rounded border border-border bg-muted/30">
                        <div className="flex gap-2">
                          <span className="text-muted-foreground">API URL:</span>
                          <span className="font-medium break-all">{(selectedTemplate.config as any).airflow_connection.api_url}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground">Username:</span>
                          <span className="font-medium">{(selectedTemplate.config as any).airflow_connection.username}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground">Password:</span>
                          <span className="font-medium">••••••••</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="animate-slide-up" style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}>
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2">DAG CONFIGURATION</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {displayConfig(selectedTemplate.config).map(([key, value]) => (
                        <div key={key} className="flex gap-2">
                          <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}:</span>
                          <span className="font-medium break-all">{Array.isArray(value) ? value.join(", ") : String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground animate-fade-in p-4">
              <Activity className="w-12 h-12 text-primary/30 mb-4" />
              <p className="text-sm text-center">Select a DAG template or create a new one.</p>
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
