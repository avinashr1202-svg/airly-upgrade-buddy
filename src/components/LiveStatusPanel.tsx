import { useEffect, useRef } from "react";
import { Loader2, CheckCircle, XCircle, FileCode } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { FileEntry } from "@/types/pipeline";

interface LiveStatusPanelProps {
  files: FileEntry[];
}

export function LiveStatusPanel({ files }: LiveStatusPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const processingFiles = files.filter((f) => f.stage === "migration" || f.stage === "testing");
  const recentlyDone = files.filter(
    (f) =>
      f.liveLog.length > 0 &&
      f.stage !== "migration" &&
      f.stage !== "testing" &&
      f.stage !== "deployed"
  );

  const allLogFiles = [...processingFiles, ...recentlyDone];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [allLogFiles.map((f) => f.liveLog.length).join(",")]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-card/50 flex items-center gap-2">
        <Loader2 className="w-4 h-4 text-primary animate-spin" />
        <span className="text-sm font-semibold text-foreground">Live Pipeline Status</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {processingFiles.length} file(s) processing
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {allLogFiles.map((file) => {
          const isProcessing = file.stage === "migration" || file.stage === "testing";
          const stageName = file.stage === "migration" ? "Migrating" : file.stage === "testing" ? "Testing" : 
            file.stage === "migration_done" ? "Migration Done" :
            file.stage === "ready_for_download" ? "Ready" :
            file.stage === "completed" ? "Completed" : file.stage;

          return (
            <div key={file.id} className="border border-border rounded-lg overflow-hidden">
              <div className="flex items-center gap-3 px-3 py-2 bg-muted/30 border-b border-border">
                <FileCode className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-semibold truncate">{file.name}</span>
                <span className={`text-[10px] font-medium ml-auto px-2 py-0.5 rounded-full ${
                  isProcessing
                    ? "bg-primary/10 text-primary"
                    : file.error
                    ? "bg-destructive/10 text-destructive"
                    : "bg-green-500/10 text-green-600"
                }`}>
                  {stageName}
                </span>
              </div>

              {isProcessing && (
                <div className="px-3 py-1.5">
                  <Progress value={file.progress} className="h-1.5" />
                  <span className="text-[10px] text-muted-foreground">{file.progress}%</span>
                </div>
              )}

              <div className="px-3 py-2 space-y-0.5 max-h-48 overflow-y-auto">
                {file.liveLog.map((log, idx) => {
                  const isLast = idx === file.liveLog.length - 1 && isProcessing;
                  const isError = log.includes("❌");
                  const isSuccess = log.includes("✅");
                  const isWarning = log.includes("⚠️");

                  return (
                    <div
                      key={idx}
                      className={`flex items-start gap-2 text-[11px] font-mono ${
                        isError
                          ? "text-destructive"
                          : isSuccess
                          ? "text-green-600"
                          : isWarning
                          ? "text-yellow-600"
                          : "text-muted-foreground"
                      } ${isLast ? "font-medium" : ""}`}
                    >
                      {isLast && !isError && !isSuccess ? (
                        <Loader2 className="w-3 h-3 animate-spin mt-0.5 shrink-0 text-primary" />
                      ) : isSuccess ? (
                        <CheckCircle className="w-3 h-3 mt-0.5 shrink-0" />
                      ) : isError ? (
                        <XCircle className="w-3 h-3 mt-0.5 shrink-0" />
                      ) : (
                        <span className="w-3 text-center shrink-0 mt-0.5">›</span>
                      )}
                      <span>{log}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
