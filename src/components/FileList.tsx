import { Upload, FileCode2, CheckCircle2, AlertCircle, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CircularProgress } from "./CircularProgress";
import type { FileEntry, PipelineStage } from "@/types/pipeline";
import { useRef } from "react";

export type FileTab = "deployed" | "migration" | "testing" | "download";

interface FileListProps {
  files: FileEntry[];
  activeTab: FileTab;
  onTabChange: (tab: FileTab) => void;
  onUploadFiles: (files: File[]) => void;
  onSelectFile: (id: string) => void;
  onRemoveFile: (id: string) => void;
  onDownloadFile: (id: string) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  selectionMode: "migration" | "testing" | null;
}

function getStageLabel(stage: PipelineStage): string {
  switch (stage) {
    case "deployed": return "Deployed";
    case "migration": return "Migrating...";
    case "migration_done": return "Migrated";
    case "testing": return "Testing...";
    case "completed": return "Completed";
    case "ready_for_download": return "Ready for Download";
    default: return "";
  }
}

function isProcessing(stage: PipelineStage) {
  return stage === "migration" || stage === "testing";
}

function isSelectable(stage: PipelineStage, mode: "migration" | "testing" | null): boolean {
  if (mode === "migration") return stage === "deployed";
  if (mode === "testing") return stage === "migration_done";
  return false;
}

function getFilesForTab(files: FileEntry[], tab: FileTab): FileEntry[] {
  switch (tab) {
    case "deployed":
      return files.filter((f) => f.stage === "deployed");
    case "migration":
      return files.filter((f) => ["migration", "migration_done"].includes(f.stage));
    case "testing":
      return files.filter((f) => ["testing", "completed"].includes(f.stage));
    case "download":
      return files.filter((f) => f.stage === "ready_for_download");
  }
}

function getTabCount(files: FileEntry[], tab: FileTab): number {
  return getFilesForTab(files, tab).length;
}

const TABS: { key: FileTab; label: string }[] = [
  { key: "deployed", label: "Deployed" },
  { key: "migration", label: "Migration" },
  { key: "testing", label: "Testing" },
  { key: "download", label: "Download" },
];

export function FileList({
  files,
  activeTab,
  onTabChange,
  onUploadFiles,
  onSelectFile,
  onRemoveFile,
  onDownloadFile,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  selectionMode,
}: FileListProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const tabFiles = getFilesForTab(files, activeTab);

  return (
    <div className="flex flex-col h-full">
      {/* Upload button */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-semibold text-foreground">Files</span>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="w-3 h-3 mr-1" />
          Upload .py
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".py"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) {
              onUploadFiles(Array.from(e.target.files));
              e.target.value = "";
            }
          }}
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {TABS.map((tab) => {
          const count = getTabCount(files, tab.key);
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`flex-1 text-[10px] font-medium py-2 border-b-2 transition-colors ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`ml-1 px-1 py-0.5 rounded-full text-[9px] ${
                  isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selection mode banner */}
      {selectionMode && activeTab === "deployed" && selectionMode === "migration" && (
        <div className="px-4 py-2 bg-primary/10 border-b border-border text-xs text-primary font-medium flex items-center justify-between">
          <span>Select files to migrate</span>
          <button onClick={onSelectAll} className="underline hover:text-primary/80 transition-colors">
            Select All
          </button>
        </div>
      )}
      {selectionMode && activeTab === "migration" && selectionMode === "testing" && (
        <div className="px-4 py-2 bg-primary/10 border-b border-border text-xs text-primary font-medium flex items-center justify-between">
          <span>Select files to test</span>
          <button onClick={onSelectAll} className="underline hover:text-primary/80 transition-colors">
            Select All
          </button>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-auto scrollbar-thin p-2 space-y-1">
        {tabFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs gap-2 p-4 text-center">
            {activeTab === "deployed" && (
              <>
                <Upload className="w-6 h-6" />
                <span>Upload .py files to deploy</span>
              </>
            )}
            {activeTab === "migration" && <span>No files in migration stage</span>}
            {activeTab === "testing" && <span>No files in testing stage</span>}
            {activeTab === "download" && (
              <>
                <Download className="w-6 h-6" />
                <span>Completed files will appear here</span>
              </>
            )}
          </div>
        ) : (
          tabFiles.map((file) => {
            const canSelect =
              (selectionMode === "migration" && activeTab === "deployed" && file.stage === "deployed") ||
              (selectionMode === "testing" && activeTab === "migration" && file.stage === "migration_done");
            const isSelected = selectedIds.has(file.id);

            return (
              <div
                key={file.id}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md hover:bg-muted/50 transition-colors group"
              >
                {canSelect && (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelect(file.id)}
                    className="shrink-0"
                  />
                )}

                <button
                  onClick={() => onSelectFile(file.id)}
                  className="flex-1 flex items-center gap-3 text-left min-w-0"
                >
                  {file.error ? (
                    <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                  ) : file.stage === "completed" || file.stage === "ready_for_download" ? (
                    <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                  ) : isProcessing(file.stage) ? (
                    <CircularProgress progress={file.progress} size={24} strokeWidth={2.5} />
                  ) : file.stage === "migration_done" ? (
                    <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
                  ) : (
                    <FileCode2 className="w-5 h-5 text-muted-foreground shrink-0" />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground truncate">{file.name}</div>
                    <div className={`text-[10px] ${file.error ? "text-destructive" : "text-muted-foreground"}`}>
                      {file.error || getStageLabel(file.stage)}
                    </div>
                  </div>
                </button>

                {activeTab === "deployed" && file.stage === "deployed" && !selectionMode && (
                  <Trash2
                    className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all shrink-0 cursor-pointer"
                    onClick={() => onRemoveFile(file.id)}
                  />
                )}

                {activeTab === "download" && file.stage === "ready_for_download" && (
                  <Download
                    className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary transition-all shrink-0 cursor-pointer"
                    onClick={() => onDownloadFile(file.id)}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
