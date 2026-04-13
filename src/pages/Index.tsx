import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { FileList } from "@/components/FileList";
import { PipelineControls } from "@/components/PipelineControls";
import { FileDetailModal } from "@/components/FileDetailModal";
import { CustomRulesPanel } from "@/components/CustomRulesPanel";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import type { FileEntry, PipelineStage } from "@/types/pipeline";

let fileCounter = 0;
const createFile = (name: string, code: string): FileEntry => ({
  id: `file-${++fileCounter}`,
  name,
  inputCode: code,
  stage: "idle",
  progress: 0,
  migrationResult: null,
  deployResult: null,
  testResult: null,
  error: null,
});

const Index = () => {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pausedStage, setPausedStage] = useState<string>("");

  const selectedFile = files.find((f) => f.id === selectedFileId) || null;

  const updateFile = useCallback((id: string, updates: Partial<FileEntry>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  }, []);

  const handleUploadFiles = useCallback((uploadedFiles: File[]) => {
    uploadedFiles.forEach((file) => {
      if (!file.name.endsWith(".py")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const code = e.target?.result as string;
        const entry = createFile(file.name, code);
        setFiles((prev) => [...prev, entry]);
      };
      reader.readAsText(file);
    });
  }, []);

  const handleRemoveFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleSelectFile = useCallback((id: string) => {
    const file = files.find((f) => f.id === id);
    if (file && file.stage !== "idle") {
      setSelectedFileId(id);
      setModalOpen(true);
    }
  }, [files]);

  // Run migration stage for a single file
  async function runMigration(file: FileEntry): Promise<boolean> {
    updateFile(file.id, { stage: "migration", progress: 10, error: null });

    try {
      updateFile(file.id, { progress: 30 });
      const { data, error } = await supabase.functions.invoke("migrate-dag", {
        body: { code: file.inputCode, mode: "migrate" },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      updateFile(file.id, {
        stage: "migration_done",
        progress: 100,
        migrationResult: data,
      });
      return true;
    } catch (err: any) {
      updateFile(file.id, { stage: "idle", progress: 0, error: err.message || "Migration failed" });
      return false;
    }
  }

  // Run deployment stage for a single file
  async function runDeployment(file: FileEntry): Promise<boolean> {
    const code = file.migrationResult?.fixed_code;
    if (!code) return false;

    updateFile(file.id, { stage: "deployment", progress: 10 });

    try {
      updateFile(file.id, { progress: 40 });
      const { data, error } = await supabase.functions.invoke("deploy-stage", {
        body: { code },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      updateFile(file.id, {
        stage: "deployment_done",
        progress: 100,
        deployResult: data,
      });
      return true;
    } catch (err: any) {
      updateFile(file.id, { error: err.message || "Deployment stage failed" });
      return false;
    }
  }

  // Run testing stage for a single file
  async function runTesting(file: FileEntry): Promise<boolean> {
    const code = file.deployResult?.deployed_code || file.migrationResult?.fixed_code;
    if (!code) return false;

    updateFile(file.id, { stage: "testing", progress: 10 });

    try {
      updateFile(file.id, { progress: 50 });
      const { data, error } = await supabase.functions.invoke("test-stage", {
        body: { code, original_code: file.inputCode },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      updateFile(file.id, {
        stage: "completed",
        progress: 100,
        testResult: data,
      });
      return true;
    } catch (err: any) {
      updateFile(file.id, { error: err.message || "Testing stage failed" });
      return false;
    }
  }

  // Start full pipeline
  const handleStartPipeline = async () => {
    const pending = files.filter((f) => f.stage === "idle" && f.inputCode.trim());
    if (pending.length === 0) {
      toast.info("No files to process.");
      return;
    }

    // Stage 1: Migration
    toast.info(`Starting migration for ${pending.length} file(s)...`);
    for (const file of pending) {
      await runMigration(file);
    }

    // Pause after migration
    setIsPaused(true);
    setPausedStage("migration");
    toast.success("Migration complete. Review results, then continue to Deployment stage.");
  };

  const handleContinuePipeline = async () => {
    setIsPaused(false);

    if (pausedStage === "migration") {
      // Stage 2: Deployment
      const migrated = files.filter((f) => f.stage === "migration_done");
      toast.info(`Starting deployment stage for ${migrated.length} file(s)...`);

      for (const file of migrated) {
        // Get fresh file state
        const freshFile = files.find((f) => f.id === file.id);
        if (freshFile) await runDeployment(freshFile);
      }

      setIsPaused(true);
      setPausedStage("deployment");
      toast.success("Deployment stage complete. Review results, then continue to Testing.");
    } else if (pausedStage === "deployment") {
      // Stage 3: Testing
      const deployed = files.filter((f) => f.stage === "deployment_done");
      toast.info(`Starting testing stage for ${deployed.length} file(s)...`);

      for (const file of deployed) {
        const freshFile = files.find((f) => f.id === file.id);
        if (freshFile) await runTesting(freshFile);
      }

      setIsPaused(false);
      setPausedStage("");
      toast.success("All stages complete! Click on files to view detailed results.");
    }
  };

  const handleReset = () => {
    fileCounter = 0;
    setFiles([]);
    setSelectedFileId(null);
    setIsPaused(false);
    setPausedStage("");
  };

  const getCurrentStage = (): string => {
    if (files.some((f) => f.stage === "testing")) return "testing";
    if (files.some((f) => f.stage === "deployment" || f.stage === "deployment_done")) return "deployment";
    if (files.some((f) => f.stage === "migration" || f.stage === "migration_done")) return "migration";
    if (files.some((f) => f.stage === "completed")) return "completed";
    return "";
  };

  const hasDragTarget = files.length === 0;

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />

      <PipelineControls
        files={files}
        onMigrateAll={handleStartPipeline}
        onContinuePipeline={handleContinuePipeline}
        onReset={handleReset}
        isPaused={isPaused}
        currentStage={getCurrentStage()}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left: File list */}
        <div className="w-72 border-r border-border flex flex-col shrink-0">
          <FileList
            files={files}
            onUploadFiles={handleUploadFiles}
            onSelectFile={handleSelectFile}
            onRemoveFile={handleRemoveFile}
          />
        </div>

        {/* Center: Drop zone / status */}
        <div className="flex-1 flex flex-col items-center justify-center min-w-0">
          {files.length === 0 ? (
            <div
              className="flex flex-col items-center gap-4 text-muted-foreground p-8 border-2 border-dashed border-border rounded-xl max-w-md mx-auto cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".py";
                input.multiple = true;
                input.onchange = (e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.files?.length) handleUploadFiles(Array.from(target.files));
                };
                input.click();
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const droppedFiles = Array.from(e.dataTransfer.files).filter((f) => f.name.endsWith(".py"));
                if (droppedFiles.length) handleUploadFiles(droppedFiles);
              }}
            >
              <Upload className="w-12 h-12 text-primary/50" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Drop .py files here or click to upload</p>
                <p className="text-xs text-muted-foreground mt-1">Upload your Airflow 2.x DAG files to begin the migration pipeline</p>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground space-y-2">
              <p className="text-sm">
                {files.every((f) => f.stage === "completed")
                  ? "✅ All files have completed the pipeline. Click a file to view details."
                  : files.every((f) => f.stage === "idle")
                  ? "Files uploaded. Click 'Start Pipeline' to begin migration."
                  : isPaused
                  ? `⏸ Pipeline paused. Review results, then click 'Continue'.`
                  : "Processing..."}
              </p>
              <p className="text-xs">
                {files.filter((f) => f.stage === "completed").length} / {files.length} completed
              </p>
            </div>
          )}
        </div>

        {/* Right: Rules panel */}
        <div className="w-80 border-l border-border flex flex-col shrink-0">
          <CustomRulesPanel />
        </div>
      </div>

      <FileDetailModal
        file={selectedFile}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
};

export default Index;
