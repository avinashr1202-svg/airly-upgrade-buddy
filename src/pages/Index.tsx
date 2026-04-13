import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { FileList } from "@/components/FileList";
import type { FileTab } from "@/components/FileList";
import { PipelineControls } from "@/components/PipelineControls";
import { CodeDiffViewer } from "@/components/CodeDiffViewer";
import { LiveStatusPanel } from "@/components/LiveStatusPanel";

import { Upload } from "lucide-react";
import { toast } from "sonner";
import type { FileEntry } from "@/types/pipeline";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

let fileCounter = 0;
const createFile = (name: string, code: string): FileEntry => ({
  id: `file-${++fileCounter}`,
  name,
  inputCode: code,
  stage: "deployed",
  progress: 0,
  migrationResult: null,
  deployResult: null,
  testResult: null,
  error: null,
  liveLog: [],
});

const Index = () => {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState<"migration" | "testing" | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<FileTab>("deployed");

  const selectedFile = files.find((f) => f.id === selectedFileId) || null;

  const updateFile = useCallback((id: string, updates: Partial<FileEntry>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  }, []);

  const appendLog = useCallback((id: string, msg: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, liveLog: [...f.liveLog, `[${new Date().toLocaleTimeString()}] ${msg}`] } : f))
    );
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
    setActiveTab("deployed");
    toast.success("Files deployed to utility successfully.");
  }, []);

  const handleRemoveFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handleSelectFile = useCallback((id: string) => {
    const file = files.find((f) => f.id === id);
    if (file && file.stage !== "deployed") {
      setSelectedFileId(id);
    }
  }, [files]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const eligible = files.filter((f) => {
      if (selectionMode === "migration") return f.stage === "deployed";
      if (selectionMode === "testing") return f.stage === "migration_done";
      return false;
    });
    const eligibleIds = eligible.map((f) => f.id);
    setSelectedIds((prev) => {
      const allSelected = eligibleIds.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(eligibleIds);
    });
  }, [files, selectionMode]);

  const handleEnterSelectionMode = useCallback((mode: "migration" | "testing") => {
    setSelectionMode(mode);
    setSelectedIds(new Set());
    // Switch to the relevant tab
    if (mode === "migration") setActiveTab("deployed");
    if (mode === "testing") setActiveTab("migration");
  }, []);

  const handleDownloadFile = useCallback((id: string) => {
    const file = files.find((f) => f.id === id);
    if (!file) return;
    const finalCode = file.deployResult?.deployed_code || file.migrationResult?.fixed_code || file.inputCode;
    const blob = new Blob([finalCode], { type: "text/x-python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name.replace(".py", "_airflow3.py");
    a.click();
    URL.revokeObjectURL(url);
  }, [files]);

  // Run migration for selected files
  async function runMigration(file: FileEntry): Promise<boolean> {
    updateFile(file.id, { stage: "migration", progress: 10, error: null, liveLog: [] });
    appendLog(file.id, `Starting migration for ${file.name}...`);
    try {
      appendLog(file.id, "Analyzing Airflow 2.x code structure...");
      updateFile(file.id, { progress: 20 });
      await delay(400);
      appendLog(file.id, "Identifying deprecated imports and operators...");
      updateFile(file.id, { progress: 40 });
      await delay(300);
      appendLog(file.id, "Applying Airflow 3.x standard import mappings...");
      updateFile(file.id, { progress: 50 });
      const { data, error } = await supabase.functions.invoke("migrate-dag", {
        body: { code: file.inputCode, mode: "migrate" },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      appendLog(file.id, "Replacing deprecated operators and parameters...");
      updateFile(file.id, { progress: 80 });
      await delay(300);
      appendLog(file.id, "Validating Python 3.13 compatibility...");
      updateFile(file.id, { progress: 90 });
      await delay(200);
      appendLog(file.id, `✅ Migration complete — ${data.changes?.length || 0} change(s) applied.`);
      updateFile(file.id, { stage: "migration_done", progress: 100, migrationResult: data });
      return true;
    } catch (err: any) {
      appendLog(file.id, `❌ Migration failed: ${err.message}`);
      updateFile(file.id, { stage: "deployed", progress: 0, error: err.message || "Migration failed" });
      return false;
    }
  }

  // Run testing for selected files
  async function runTesting(file: FileEntry): Promise<boolean> {
    const code = file.migrationResult?.fixed_code;
    if (!code) return false;
    updateFile(file.id, { stage: "testing", progress: 10, liveLog: [] });
    appendLog(file.id, `Starting tests for ${file.name}...`);
    try {
      appendLog(file.id, "Checking Airflow 3.x import paths...");
      updateFile(file.id, { progress: 20 });
      await delay(400);
      appendLog(file.id, "Validating DAG structure and task dependencies...");
      updateFile(file.id, { progress: 35 });
      await delay(300);
      appendLog(file.id, "Running operator compatibility checks...");
      updateFile(file.id, { progress: 50 });
      const { data, error } = await supabase.functions.invoke("test-stage", {
        body: { code, original_code: file.inputCode },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      appendLog(file.id, "Verifying parameter naming conventions...");
      updateFile(file.id, { progress: 70 });
      await delay(300);
      appendLog(file.id, "Checking Python 3.13 type hints and syntax...");
      updateFile(file.id, { progress: 85 });
      await delay(200);

      const allPassed = data?.overall_status === "pass";
      const testCount = data?.tests?.length || 0;
      const passCount = data?.tests?.filter((t: any) => t.status === "pass").length || 0;

      if (allPassed) {
        appendLog(file.id, `✅ All ${testCount} test(s) passed! Ready for download.`);
        updateFile(file.id, { stage: "ready_for_download", progress: 100, testResult: data });
      } else {
        appendLog(file.id, `⚠️ ${passCount}/${testCount} test(s) passed. Review results for details.`);
        updateFile(file.id, { stage: "completed", progress: 100, testResult: data });
      }
      return true;
    } catch (err: any) {
      appendLog(file.id, `❌ Testing failed: ${err.message}`);
      updateFile(file.id, { stage: "migration_done", progress: 0, error: err.message || "Testing failed" });
      return false;
    }
  }

  const handleStartMigration = async () => {
    const toMigrate = files.filter((f) => selectedIds.has(f.id) && f.stage === "deployed");
    if (toMigrate.length === 0) return;

    setSelectionMode(null);
    setSelectedIds(new Set());
    setActiveTab("migration");
    toast.info(`Migrating ${toMigrate.length} file(s)...`);

    for (const file of toMigrate) {
      await runMigration(file);
    }
    toast.success("Migration complete. Click files to review results.");
  };

  const handleStartTesting = async () => {
    const toTest = files.filter((f) => selectedIds.has(f.id) && f.stage === "migration_done");
    if (toTest.length === 0) return;

    setSelectionMode(null);
    setSelectedIds(new Set());
    setActiveTab("testing");
    toast.info(`Testing ${toTest.length} file(s)...`);

    for (const file of toTest) {
      await runTesting(file);
    }
    
    const downloadReady = files.filter((f) => f.stage === "ready_for_download").length;
    if (downloadReady > 0) {
      toast.success(`Testing complete. ${downloadReady} file(s) ready for download.`);
    } else {
      toast.success("Testing complete. Click files to view detailed results.");
    }
  };

  const handleReset = () => {
    fileCounter = 0;
    setFiles([]);
    setSelectedFileId(null);
    setSelectionMode(null);
    setSelectedIds(new Set());
    setActiveTab("deployed");
  };

  const anyProcessing = files.some((f) => f.stage === "migration" || f.stage === "testing");

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />

      <PipelineControls
        files={files}
        onStartMigration={handleStartMigration}
        onStartTesting={handleStartTesting}
        onReset={handleReset}
        onEnterSelectionMode={handleEnterSelectionMode}
        selectionMode={selectionMode}
        selectedCount={selectedIds.size}
        anyProcessing={anyProcessing}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left: File list with tabs */}
        <div className="w-72 border-r border-border flex flex-col shrink-0">
          <FileList
            files={files}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onUploadFiles={handleUploadFiles}
            onSelectFile={handleSelectFile}
            onRemoveFile={handleRemoveFile}
            onDownloadFile={handleDownloadFile}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            selectionMode={selectionMode}
          />
        </div>

        {/* Right: Diff viewer, live status, or placeholder */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedFile && selectedFile.stage !== "deployed" ? (
            <CodeDiffViewer file={selectedFile} />
          ) : anyProcessing ? (
            <LiveStatusPanel files={files} />
          ) : files.length === 0 ? (
            <div
              className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground p-8 cursor-pointer"
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
              <div className="border-2 border-dashed border-border rounded-xl p-8 max-w-md hover:border-primary/50 transition-colors">
                <Upload className="w-12 h-12 text-primary/50 mx-auto mb-4" />
                <p className="text-sm font-medium text-foreground text-center">Drop .py files here or click to upload</p>
                <p className="text-xs text-muted-foreground mt-1 text-center">Upload your Airflow 2.x DAG files to deploy to the utility</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground space-y-2">
              <p className="text-sm">
                {files.every((f) => f.stage === "ready_for_download")
                  ? "✅ All files ready for download!"
                  : files.every((f) => f.stage === "completed" || f.stage === "ready_for_download")
                  ? "✅ All files completed. Check the Download tab for successful files."
                  : selectionMode === "migration"
                  ? "📋 Select deployed files to migrate, then click 'Migrate'."
                  : selectionMode === "testing"
                  ? "📋 Select migrated files to test, then click 'Test'."
                  : "Click a migrated file to view the side-by-side diff."}
              </p>
              <p className="text-xs">
                {files.filter((f) => f.stage === "deployed").length} deployed ·{" "}
                {files.filter((f) => f.stage === "migration_done").length} migrated ·{" "}
                {files.filter((f) => f.stage === "completed").length} tested ·{" "}
                {files.filter((f) => f.stage === "ready_for_download").length} ready for download
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
