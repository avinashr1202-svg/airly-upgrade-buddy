import { Plus, X, Upload, FileCode2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FileEntry } from "@/types/pipeline";
import { useRef } from "react";

interface FileTabsProps {
  files: FileEntry[];
  activeFileId: string;
  onSelectFile: (id: string) => void;
  onAddFile: () => void;
  onCloseFile: (id: string) => void;
  onUploadFiles: (files: File[]) => void;
}

export function FileTabs({ files, activeFileId, onSelectFile, onAddFile, onCloseFile, onUploadFiles }: FileTabsProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center border-b border-border bg-card/50 overflow-x-auto scrollbar-thin">
      <div className="flex items-center min-w-0 flex-1">
        {files.map((file) => {
          const isActive = file.id === activeFileId;
          const isMigrated = !!file.outputCode;

          return (
            <button
              key={file.id}
              onClick={() => onSelectFile(file.id)}
              className={`group flex items-center gap-1.5 px-3 py-2 text-xs border-r border-border shrink-0 transition-colors ${
                isActive
                  ? "bg-background text-foreground border-b-2 border-b-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {file.isLoading ? (
                <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
              ) : isMigrated ? (
                <CheckCircle2 className="w-3 h-3 text-success shrink-0" />
              ) : (
                <FileCode2 className="w-3 h-3 shrink-0" />
              )}
              <span className="truncate max-w-[120px]">{file.name}</span>
              {files.length > 1 && (
                <X
                  className="w-3 h-3 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseFile(file.id);
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1 px-2 shrink-0">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={onAddFile}>
          <Plus className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="w-3 h-3 mr-1" />
          Upload Files
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
    </div>
  );
}
