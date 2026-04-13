import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { FileList } from "@/components/FileList";
import { PipelineControls } from "@/components/PipelineControls";
import { FileDetailModal } from "@/components/FileDetailModal";

import { Upload } from "lucide-react";
import { toast } from "sonner";
import type { FileEntry } from "@/types/pipeline";

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
});

const Index = () => {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState<"migration" | "testing" | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectedFile = files.find((f) => f.id === selectedFileId) || null;

  const updateFile = useCallback((id: string, updates: Partial<FileEntry>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  }, []);

  const handleUploadFiles = useCallback((uploadedFiles: File[]) => {
    let count = 0;
    uploadedFiles.forEach((file) => {
      if (!file.name.endsWith(".py")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const code = e.target?.result as string;
        const entry = createFile(file.name, code);
        setFiles((prev) => [...prev, entry]);
        count++;
      };
      reader.readAsText(file);
    });
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
      setModalOpen(true);
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
      if (allSelected) return new Set(); // deselect all
      return new Set(eligibleIds);
    });
  }, [files, selectionMode]);

  const handleEnterSelectionMode = useCallback((mode: "migration" | "testing") => {
    setSelectionMode(mode);
    setSelectedIds(new Set());
  }, []);

  // Run migration for selected files
  async function runMigration(file: FileEntry): Promise<boolean> {
    updateFile(file.id, { stage: "migration", progress: 10, error: null });
    try {
      updateFile(file.id, { progress: 30 });
      const { data, error } = await supabase.functions.invoke("migrate-dag", {
        body: { code: file.inputCode, mode: "migrate" },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      updateFile(file.id, { stage: "migration_done", progress: 100, migrationResult: data });
      return true;
    } catch (err: any) {
      updateFile(file.id, { stage: "deployed", progress: 0, error: err.message || "Migration failed" });
      return false;
    }
  }

  // Run testing for selected files
  async function runTesting(file: FileEntry): Promise<boolean> {
    const code = file.migrationResult?.fixed_code;
    if (!code) return false;
    updateFile(file.id, { stage: "testing", progress: 10 });
    try {
      updateFile(file.id, { progress: 50 });
      const { data, error } = await supabase.functions.invoke("test-stage", {
        body: { code, original_code: file.inputCode },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      updateFile(file.id, { stage: "completed", progress: 100, testResult: data });
      return true;
    } catch (err: any) {
      updateFile(file.id, { stage: "migration_done", progress: 0, error: err.message || "Testing failed" });
      return false;
    }
  }

  const handleStartMigration = async () => {
    const toMigrate = files.filter((f) => selectedIds.has(f.id) && f.stage === "deployed");
    if (toMigrate.length === 0) return;

    setSelectionMode(null);
    setSelectedIds(new Set());
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
    toast.info(`Testing ${toTest.length} file(s)...`);

    for (const file of toTest) {
      await runTesting(file);
    }
    toast.success("Testing complete. Click files to view detailed results.");
  };

  const handleReset = () => {
    fileCounter = 0;
    setFiles([]);
    setSelectedFileId(null);
    setSelectionMode(null);
    setSelectedIds(new Set());
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
        {/* Left: File list */}
        <div className="w-72 border-r border-border flex flex-col shrink-0">
          <FileList
            files={files}
            onUploadFiles={handleUploadFiles}
            onSelectFile={handleSelectFile}
            onRemoveFile={handleRemoveFile}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            selectionMode={selectionMode}
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
                <p className="text-xs text-muted-foreground mt-1">Upload your Airflow 2.x DAG files to deploy to the utility</p>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground space-y-2">
              <p className="text-sm">
                {files.every((f) => f.stage === "completed")
                  ? "✅ All files completed. Click a file to view details."
                  : selectionMode === "migration"
                  ? "📋 Select deployed files to migrate, then click 'Migrate'."
                  : selectionMode === "testing"
                  ? "📋 Select migrated files to test, then click 'Test'."
                  : anyProcessing
                  ? "⏳ Processing..."
                  : "Files deployed. Use 'Select & Migrate' to choose files for migration."}
              </p>
              <p className="text-xs">
                {files.filter((f) => f.stage === "deployed").length} deployed · {files.filter((f) => f.stage === "migration_done").length} migrated · {files.filter((f) => f.stage === "completed").length} completed
              </p>
            </div>
          )}
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
