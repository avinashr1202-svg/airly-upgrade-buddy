import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { CodeInput } from "@/components/CodeInput";
import { CodeOutput } from "@/components/CodeOutput";
import { ChangesList, type MigrationResult } from "@/components/ChangesList";
import { MigrationRules } from "@/components/MigrationRules";
import { FileTabs } from "@/components/FileTabs";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight, RotateCcw, Play } from "lucide-react";
import { toast } from "sonner";

export interface FileEntry {
  id: string;
  name: string;
  inputCode: string;
  outputCode: string;
  result: MigrationResult | null;
  isLoading: boolean;
}

let fileCounter = 0;
const createFile = (name = "untitled.py", code = ""): FileEntry => ({
  id: `file-${++fileCounter}`,
  name,
  inputCode: code,
  outputCode: "",
  result: null,
  isLoading: false,
});

const Index = () => {
  const [files, setFiles] = useState<FileEntry[]>([createFile()]);
  const [activeFileId, setActiveFileId] = useState(files[0].id);
  const [activeTab, setActiveTab] = useState("changes");

  const activeFile = files.find((f) => f.id === activeFileId) || files[0];

  const updateFile = useCallback((id: string, updates: Partial<FileEntry>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  }, []);

  const handleAddFile = useCallback(() => {
    const newFile = createFile();
    setFiles((prev) => [...prev, newFile]);
    setActiveFileId(newFile.id);
  }, []);

  const handleCloseFile = useCallback(
    (id: string) => {
      setFiles((prev) => {
        if (prev.length <= 1) return prev;
        const next = prev.filter((f) => f.id !== id);
        if (activeFileId === id) {
          setActiveFileId(next[next.length - 1].id);
        }
        return next;
      });
    },
    [activeFileId]
  );

  const handleUploadFiles = useCallback((uploadedFiles: File[]) => {
    const newEntries: FileEntry[] = [];
    let lastId = "";

    uploadedFiles.forEach((file) => {
      if (!file.name.endsWith(".py")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const code = e.target?.result as string;
        const entry = createFile(file.name, code);
        newEntries.push(entry);
        lastId = entry.id;
        setFiles((prev) => [...prev, entry]);
        if (lastId) setActiveFileId(lastId);
      };
      reader.readAsText(file);
    });
  }, []);

  const handleMigrate = async () => {
    if (!activeFile.inputCode.trim()) {
      toast.error("Please paste or upload your Airflow 2.x DAG code first.");
      return;
    }

    updateFile(activeFile.id, { isLoading: true, outputCode: "", result: null });

    try {
      const { data, error } = await supabase.functions.invoke("migrate-dag", {
        body: { code: activeFile.inputCode, mode: "migrate" },
      });

      if (error) throw new Error(error.message || "Migration failed");
      if (data?.error) throw new Error(data.error);

      updateFile(activeFile.id, {
        outputCode: data.fixed_code || "",
        result: data,
        isLoading: false,
      });
      setActiveTab("changes");
      toast.success(`Migration complete — ${data.changes?.length || 0} changes applied`);
    } catch (err: any) {
      console.error("Migration error:", err);
      toast.error(err.message || "Migration failed. Please try again.");
      updateFile(activeFile.id, { isLoading: false });
    }
  };

  const handleMigrateAll = async () => {
    const pending = files.filter((f) => f.inputCode.trim() && !f.outputCode);
    if (pending.length === 0) {
      toast.info("No unmigrated files to process.");
      return;
    }

    for (const file of pending) {
      updateFile(file.id, { isLoading: true, outputCode: "", result: null });
    }

    for (const file of pending) {
      try {
        const { data, error } = await supabase.functions.invoke("migrate-dag", {
          body: { code: file.inputCode, mode: "migrate" },
        });

        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);

        updateFile(file.id, {
          outputCode: data.fixed_code || "",
          result: data,
          isLoading: false,
        });
      } catch (err: any) {
        console.error(`Migration error for ${file.name}:`, err);
        updateFile(file.id, { isLoading: false });
        toast.error(`Failed to migrate ${file.name}`);
      }
    }

    toast.success(`Batch migration complete for ${pending.length} file(s)`);
  };

  const handleReset = () => {
    fileCounter = 0;
    const fresh = createFile();
    setFiles([fresh]);
    setActiveFileId(fresh.id);
  };

  const anyLoading = files.some((f) => f.isLoading);

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />

      {/* File Tabs */}
      <FileTabs
        files={files}
        activeFileId={activeFileId}
        onSelectFile={setActiveFileId}
        onAddFile={handleAddFile}
        onCloseFile={handleCloseFile}
        onUploadFiles={handleUploadFiles}
      />

      {/* Action Bar */}
      <div className="flex items-center justify-center gap-3 px-6 py-3 border-b border-border bg-card">
        <Button
          onClick={handleMigrate}
          disabled={anyLoading || !activeFile.inputCode.trim()}
          className="gradient-primary text-primary-foreground font-semibold px-6 glow-primary hover:opacity-90 transition-opacity"
        >
          {activeFile.isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
              Migrating...
            </>
          ) : (
            <>
              <ArrowRight className="w-4 h-4 mr-2" />
              Migrate Current
            </>
          )}
        </Button>
        {files.length > 1 && (
          <Button
            onClick={handleMigrateAll}
            disabled={anyLoading}
            variant="outline"
            size="sm"
            className="text-primary border-primary/30 hover:bg-primary/10"
          >
            <Play className="w-3 h-3 mr-1" />
            Migrate All ({files.filter((f) => f.inputCode.trim() && !f.outputCode).length})
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={handleReset} disabled={anyLoading} className="text-muted-foreground">
          <RotateCcw className="w-3 h-3 mr-1" />
          Reset
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Input */}
        <div className="flex-1 border-r border-border flex flex-col min-w-0">
          <CodeInput
            code={activeFile.inputCode}
            setCode={(code) => updateFile(activeFile.id, { inputCode: code })}
            isLoading={activeFile.isLoading}
            onUploadFiles={handleUploadFiles}
          />
        </div>

        {/* Center: Output */}
        <div className="flex-1 border-r border-border flex flex-col min-w-0">
          <CodeOutput code={activeFile.outputCode} isLoading={activeFile.isLoading} fileName={activeFile.name} />
        </div>

        {/* Right: Analysis Panel */}
        <div className="w-80 flex flex-col min-w-0 shrink-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
            <TabsList className="w-full rounded-none border-b border-border bg-card h-auto p-0">
              <TabsTrigger
                value="changes"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs py-2.5"
              >
                Changes
              </TabsTrigger>
              <TabsTrigger
                value="rules"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent text-xs py-2.5"
              >
                Rules
              </TabsTrigger>
            </TabsList>
            <TabsContent value="changes" className="flex-1 m-0 overflow-hidden">
              <ChangesList result={activeFile.result} isLoading={activeFile.isLoading} />
            </TabsContent>
            <TabsContent value="rules" className="flex-1 m-0 overflow-hidden">
              <MigrationRules />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Index;
