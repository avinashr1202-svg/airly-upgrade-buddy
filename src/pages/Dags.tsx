import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, AlertTriangle, Activity, Download, Play, Eye, Trash2, CheckCircle, XCircle, Loader2 } from "lucide-react";
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

const Dags = () => {
  const [templates, setTemplates] = useState<DagTemplate[]>([]);
  const [runs, setRuns] = useState<DagRun[]>([]);
  const [collectedErrors, setCollectedErrors] = useState<any[]>([]);
  const [monitorResults, setMonitorResults] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DagTemplate | null>(null);
  const [viewingCode, setViewingCode] = useState<DagTemplate | null>(null);
  const [runningDag, setRunningDag] = useState<string | null>(null);

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

      // Refresh results
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

  const templateRuns = selectedTemplate ? runs.filter((r) => r.template_id === selectedTemplate.id) : [];

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />

      <div className="flex-1 flex overflow-hidden">
        {/* Left: DAG templates list */}
        <div className="w-80 border-r border-border flex flex-col shrink-0">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">DAG Templates</h2>
            <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5" />
              Add DAG
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm p-4 text-center">
                <p>No DAG templates yet.</p>
                <p className="text-xs mt-1">Click "Add DAG" to create one.</p>
              </div>
            ) : (
              templates.map((t) => {
                const tRuns = runs.filter((r) => r.template_id === t.id);
                const lastRun = tRuns[0];
                return (
                  <Card
                    key={t.id}
                    className={`p-3 cursor-pointer hover:bg-accent/50 transition-colors ${
                      selectedTemplate?.id === t.id ? "ring-1 ring-primary bg-accent/30" : ""
                    }`}
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
                          <Badge variant="outline" className="text-[10px] mt-1">
                            {t.type === "error_collection" ? "Error Collection" : "Monitor"}
                          </Badge>
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
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedTemplate.type === "error_collection"
                      ? "Collects and stores Airflow errors"
                      : "Monitors DAG execution and reports status"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
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

              {/* Tabs for Config, Results, Run History */}
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
