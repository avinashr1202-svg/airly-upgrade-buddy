import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, XCircle, Loader2, ChevronDown, ChevronRight, Wrench } from "lucide-react";

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

interface DagRunsPanelProps {
  runs: DagRun[];
  templateType: "error_collection" | "monitor";
}

export function DagRunsPanel({ runs, templateType }: DagRunsPanelProps) {
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  if (runs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        {templateType === "monitor"
          ? 'No runs yet. Click "Run DAG" to start monitoring.'
          : "No error collection runs recorded yet."}
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground mb-3">EXECUTION HISTORY</h4>
        {runs.map((run) => {
          const isExpanded = expandedRun === run.id;
          return (
            <div key={run.id} className="border border-border rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center gap-3 p-3 hover:bg-accent/30 transition-colors text-left"
                onClick={() => setExpandedRun(isExpanded ? null : run.id)}
              >
                {run.status === "success" ? (
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                ) : run.status === "failed" ? (
                  <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                ) : (
                  <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">
                      {new Date(run.started_at).toLocaleString()}
                    </span>
                    <Badge
                      variant={run.status === "success" ? "default" : run.status === "failed" ? "destructive" : "secondary"}
                      className="text-[10px]"
                    >
                      {run.status}
                    </Badge>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
              </button>

              {isExpanded && (
                <div className="border-t border-border p-3 space-y-3 bg-muted/20">
                  {run.logs && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">LOGS</p>
                      <pre className="text-xs font-mono bg-background p-2 rounded border border-border overflow-x-auto whitespace-pre-wrap max-h-48">
                        {run.logs}
                      </pre>
                    </div>
                  )}
                  {run.error_details && (
                    <div>
                      <p className="text-xs font-semibold text-red-500 mb-1">ERROR DETAILS</p>
                      <pre className="text-xs font-mono bg-red-500/5 text-red-600 p-2 rounded border border-red-500/20 overflow-x-auto whitespace-pre-wrap max-h-48">
                        {run.error_details}
                      </pre>
                    </div>
                  )}
                  {run.fix_suggestion && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Wrench className="w-3.5 h-3.5 text-primary" />
                        <p className="text-xs font-semibold text-primary">HOW TO FIX</p>
                      </div>
                      <div className="text-xs bg-primary/5 p-3 rounded border border-primary/20 whitespace-pre-wrap">
                        {run.fix_suggestion}
                      </div>
                    </div>
                  )}
                  {run.completed_at && (
                    <p className="text-[10px] text-muted-foreground">
                      Completed: {new Date(run.completed_at).toLocaleString()} ·
                      Duration: {Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
