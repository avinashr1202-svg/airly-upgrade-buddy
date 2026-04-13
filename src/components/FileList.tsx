import { Upload, FileCode2, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CircularProgress } from "./CircularProgress";
import type { FileEntry } from "@/types/pipeline";
import { useRef } from "react";

interface FileListProps {
  files: FileEntry[];
  onUploadFiles: (files: File[]) => void;
  onSelectFile: (id: string) => void;
  onRemoveFile: (id: string) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  selectionMode: "migration" | "testing" | null;
}

function getStageLabel(stage: FileEntry["stage"]): string {
  switch (stage) {
    case "deployed": return "Deployed";
    case "migration": return "Migrating...";
    case "migration_done": return "Migrated";
    case "testing": return "Testing...";
    case "completed": return "Completed";
    default: return "";
  }
}

function isProcessing(stage: FileEntry["stage"]) {
  return stage === "migration" || stage === "testing";
}

function isSelectable(stage: FileEntry["stage"], mode: "migration" | "testing" | null): boolean {
  if (mode === "migration") return stage === "deployed";
  if (mode === "testing") return stage === "migration_done";
  return false;
}

export function FileList({ files, onUploadFiles, onSelectFile, onRemoveFile, selectedIds, onToggleSelect, onSelectAll, selectionMode }: FileListProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-semibold text-foreground">Uploaded Files</span>
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

      {selectionMode && (
        <div className="px-4 py-2 bg-primary/10 border-b border-border text-xs text-primary font-medium">
          Select files to {selectionMode === "migration" ? "migrate" : "test"}
        </div>
      )}

      <div className="flex-1 overflow-auto scrollbar-thin p-2 space-y-1">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs gap-2 p-4 text-center">
            <Upload className="w-6 h-6" />
            <span>Upload .py files to deploy to utility</span>
          </div>
        ) : (
          files.map((file) => {
            const canSelect = selectionMode && isSelectable(file.stage, selectionMode);
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
                  ) : file.stage === "completed" ? (
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

                {file.stage === "deployed" && !selectionMode && (
                  <Trash2
                    className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all shrink-0 cursor-pointer"
                    onClick={() => onRemoveFile(file.id)}
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
