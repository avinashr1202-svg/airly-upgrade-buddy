import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, Activity, Loader2, Server } from "lucide-react";
import { toast } from "sonner";

interface CreateDagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (template: any) => void;
}

export function CreateDagDialog({ open, onOpenChange, onCreated }: CreateDagDialogProps) {
  const [step, setStep] = useState<"choose" | "configure">("choose");
  const [dagType, setDagType] = useState<"error_collection" | "monitor" | null>(null);
  const [saving, setSaving] = useState(false);

  // Airflow connection (shared)
  const [airflowApiUrl, setAirflowApiUrl] = useState("http://localhost:8080/api/v1");
  const [airflowUsername, setAirflowUsername] = useState("admin");
  const [airflowPassword, setAirflowPassword] = useState("");

  // Error Collection fields
  const [ecName, setEcName] = useState("");
  const [ecStorage, setEcStorage] = useState<"file" | "database">("database");
  const [ecFilePath, setEcFilePath] = useState("/opt/airflow/logs/errors.log");
  const [ecDbConn, setEcDbConn] = useState("airflow_db");
  const [ecSchedule, setEcSchedule] = useState("@hourly");
  const [ecRetries, setEcRetries] = useState("3");
  const [ecEmailOnError, setEcEmailOnError] = useState(false);
  const [ecEmailTo, setEcEmailTo] = useState("");

  // Monitor fields
  const [monName, setMonName] = useState("");
  const [monTargetDags, setMonTargetDags] = useState("");
  const [monSchedule, setMonSchedule] = useState("*/5 * * * *");
  const [monSlackConn, setMonSlackConn] = useState("");
  const [monSlackChannel, setMonSlackChannel] = useState("");
  const [monAutoRetry, setMonAutoRetry] = useState(true);
  const [monMaxRetries, setMonMaxRetries] = useState("2");
  const [monAutoUnpause, setMonAutoUnpause] = useState(true);

  const resetForm = () => {
    setStep("choose");
    setDagType(null);
    setAirflowApiUrl("http://localhost:8080/api/v1");
    setAirflowUsername("admin");
    setAirflowPassword("");
    setEcName("");
    setEcStorage("database");
    setEcFilePath("/opt/airflow/logs/errors.log");
    setEcDbConn("airflow_db");
    setEcSchedule("@hourly");
    setEcRetries("3");
    setEcEmailOnError(false);
    setEcEmailTo("");
    setMonName("");
    setMonTargetDags("");
    setMonSchedule("*/5 * * * *");
    setMonSlackConn("");
    setMonSlackChannel("");
    setMonAutoRetry(true);
    setMonMaxRetries("2");
    setMonAutoUnpause(true);
  };

  const handleClose = (v: boolean) => {
    if (!v) resetForm();
    onOpenChange(v);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let name: string;
      let config: Record<string, any>;

      const airflowConnection = {
        api_url: airflowApiUrl,
        username: airflowUsername,
        password: airflowPassword,
      };

      if (dagType === "error_collection") {
        name = ecName.trim();
        if (!name) { toast.error("DAG name is required."); setSaving(false); return; }
        config = {
          airflow_connection: airflowConnection,
          storage_type: ecStorage,
          file_path: ecStorage === "file" ? ecFilePath : undefined,
          db_connection: ecStorage === "database" ? ecDbConn : undefined,
          schedule: ecSchedule,
          retries: parseInt(ecRetries) || 3,
          email_on_error: ecEmailOnError,
          email_to: ecEmailOnError ? ecEmailTo : undefined,
        };
      } else {
        name = monName.trim();
        if (!name) { toast.error("DAG name is required."); setSaving(false); return; }
        config = {
          airflow_connection: airflowConnection,
          target_dags: monTargetDags.split(",").map((s) => s.trim()).filter(Boolean),
          schedule: monSchedule,
          slack_connection: monSlackConn || undefined,
          slack_channel: monSlackChannel || undefined,
          auto_retry: monAutoRetry,
          max_retries: parseInt(monMaxRetries) || 2,
          auto_unpause: monAutoUnpause,
        };
      }

      const { data: genData, error: genError } = await supabase.functions.invoke("generate-dag", {
        body: { type: dagType, name, config },
      });

      if (genError) throw new Error(genError.message);

      const { data: template, error: insertError } = await supabase
        .from("dag_templates")
        .insert({
          name,
          type: dagType!,
          config,
          generated_code: genData?.code || null,
        })
        .select()
        .single();

      if (insertError) throw new Error(insertError.message);

      onCreated(template);
      handleClose(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to create DAG.");
    } finally {
      setSaving(false);
    }
  };

  const AirflowConnectionSection = () => (
    <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/30">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Server className="w-3.5 h-3.5" />
        AIRFLOW REST API CONNECTION
      </div>
      <div className="space-y-2">
        <Label className="text-xs">API URL *</Label>
        <Input
          placeholder="http://localhost:8080/api/v1"
          value={airflowApiUrl}
          onChange={(e) => setAirflowApiUrl(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs">Username</Label>
          <Input
            placeholder="admin"
            value={airflowUsername}
            onChange={(e) => setAirflowUsername(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Password</Label>
          <Input
            type="password"
            placeholder="••••••••"
            value={airflowPassword}
            onChange={(e) => setAirflowPassword(e.target.value)}
          />
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "choose" ? "Create New DAG" : dagType === "error_collection" ? "Error Collection DAG" : "Monitor DAG"}
          </DialogTitle>
          <DialogDescription>
            {step === "choose"
              ? "Choose the type of DAG you want to create."
              : "Configure the DAG settings and Airflow connection."}
          </DialogDescription>
        </DialogHeader>

        {step === "choose" ? (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <button
              className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-border hover:border-orange-500/50 hover:bg-orange-500/5 transition-colors"
              onClick={() => { setDagType("error_collection"); setStep("configure"); }}
            >
              <AlertTriangle className="w-8 h-8 text-orange-500" />
              <div className="text-center">
                <p className="text-sm font-semibold">Error Collection DAG</p>
                <p className="text-xs text-muted-foreground mt-1">Collect and store Airflow errors</p>
              </div>
            </button>
            <button
              className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-border hover:border-blue-500/50 hover:bg-blue-500/5 transition-colors"
              onClick={() => { setDagType("monitor"); setStep("configure"); }}
            >
              <Activity className="w-8 h-8 text-blue-500" />
              <div className="text-center">
                <p className="text-sm font-semibold">Monitor DAG</p>
                <p className="text-xs text-muted-foreground mt-1">Monitor DAG runs and status</p>
              </div>
            </button>
          </div>
        ) : dagType === "error_collection" ? (
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-xs">DAG Name *</Label>
              <Input placeholder="error_collector_dag" value={ecName} onChange={(e) => setEcName(e.target.value)} />
            </div>

            <AirflowConnectionSection />

            <div className="space-y-2">
              <Label className="text-xs">Error Storage</Label>
              <Select value={ecStorage} onValueChange={(v: "file" | "database") => setEcStorage(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="file">File</SelectItem>
                  <SelectItem value="database">Database</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {ecStorage === "file" ? (
              <div className="space-y-2">
                <Label className="text-xs">File Path</Label>
                <Input value={ecFilePath} onChange={(e) => setEcFilePath(e.target.value)} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs">Database Connection ID</Label>
                <Input placeholder="airflow_db" value={ecDbConn} onChange={(e) => setEcDbConn(e.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs">Schedule</Label>
              <Input placeholder="@hourly" value={ecSchedule} onChange={(e) => setEcSchedule(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Retries</Label>
              <Input type="number" value={ecRetries} onChange={(e) => setEcRetries(e.target.value)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Email on Error</Label>
              <Switch checked={ecEmailOnError} onCheckedChange={setEcEmailOnError} />
            </div>
            {ecEmailOnError && (
              <div className="space-y-2">
                <Label className="text-xs">Email To</Label>
                <Input placeholder="admin@example.com" value={ecEmailTo} onChange={(e) => setEcEmailTo(e.target.value)} />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep("choose")}>Back</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                Create DAG
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-xs">DAG Name *</Label>
              <Input placeholder="monitor_dag" value={monName} onChange={(e) => setMonName(e.target.value)} />
            </div>

            <AirflowConnectionSection />

            <div className="space-y-2">
              <Label className="text-xs">Target DAGs (comma-separated)</Label>
              <Textarea
                placeholder="dag_1, dag_2, dag_3"
                value={monTargetDags}
                onChange={(e) => setMonTargetDags(e.target.value)}
                rows={2}
              />
              <p className="text-[10px] text-muted-foreground">Leave empty to auto-discover all DAGs from Airflow</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Schedule</Label>
              <Input placeholder="*/5 * * * *" value={monSchedule} onChange={(e) => setMonSchedule(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Slack Connection ID (optional)</Label>
              <Input placeholder="slack_default" value={monSlackConn} onChange={(e) => setMonSlackConn(e.target.value)} />
            </div>
            {monSlackConn && (
              <div className="space-y-2">
                <Label className="text-xs">Slack Channel</Label>
                <Input placeholder="#airflow-alerts" value={monSlackChannel} onChange={(e) => setMonSlackChannel(e.target.value)} />
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label className="text-xs">Auto Unpause & Run New DAGs</Label>
              <Switch checked={monAutoUnpause} onCheckedChange={setMonAutoUnpause} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Auto Retry on Failure</Label>
              <Switch checked={monAutoRetry} onCheckedChange={setMonAutoRetry} />
            </div>
            {monAutoRetry && (
              <div className="space-y-2">
                <Label className="text-xs">Max Retries</Label>
                <Input type="number" value={monMaxRetries} onChange={(e) => setMonMaxRetries(e.target.value)} />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep("choose")}>Back</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                Create DAG
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}