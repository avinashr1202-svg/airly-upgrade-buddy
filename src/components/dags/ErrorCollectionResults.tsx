import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, AlertTriangle, ChevronDown, ChevronRight, Wrench, AlertCircle } from "lucide-react";

interface CollectedError {
  id: string;
  template_id: string;
  run_id: string | null;
  dag_name: string;
  task_id: string | null;
  error_message: string;
  short_description: string | null;
  fix_steps: string | null;
  severity: string;
  execution_date: string | null;
  collected_at: string;
}

interface ErrorCollectionResultsProps {
  errors: CollectedError[];
}

export function ErrorCollectionResults({ errors }: ErrorCollectionResultsProps) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = errors.filter(
    (e) =>
      e.dag_name.toLowerCase().includes(search.toLowerCase()) ||
      (e.task_id && e.task_id.toLowerCase().includes(search.toLowerCase())) ||
      e.error_message.toLowerCase().includes(search.toLowerCase())
  );

  const severityColor = (s: string) => {
    switch (s) {
      case "critical": return "bg-red-500/10 text-red-600 border-red-500/20";
      case "error": return "bg-orange-500/10 text-orange-600 border-orange-500/20";
      case "warning": return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (errors.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-sm p-8">
        <AlertTriangle className="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p>No errors collected yet.</p>
        <p className="text-xs mt-1">Run the Error Collection DAG to start collecting errors.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by DAG name, task, or error..."
            className="pl-8 h-8 text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">{filtered.length} error(s) found</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {filtered.map((err) => {
            const isExpanded = expandedId === err.id;
            return (
              <div key={err.id} className="border border-border rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-start gap-3 p-3 hover:bg-accent/30 transition-colors text-left"
                  onClick={() => setExpandedId(isExpanded ? null : err.id)}
                >
                  <AlertCircle className={`w-4 h-4 mt-0.5 shrink-0 ${
                    err.severity === "critical" ? "text-red-500" : err.severity === "error" ? "text-orange-500" : "text-yellow-500"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold">{err.dag_name}</span>
                      {err.task_id && (
                        <span className="text-[10px] font-mono text-muted-foreground">→ {err.task_id}</span>
                      )}
                      <Badge variant="outline" className={`text-[10px] ${severityColor(err.severity)}`}>
                        {err.severity}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 truncate">
                      {err.short_description || err.error_message}
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-border p-3 space-y-3 bg-muted/20">
                    <div>
                      <p className="text-xs font-semibold text-red-500 mb-1">ERROR MESSAGE</p>
                      <pre className="text-xs font-mono bg-red-500/5 text-red-600 p-2 rounded border border-red-500/20 whitespace-pre-wrap">
                        {err.error_message}
                      </pre>
                    </div>
                    {err.short_description && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">ROOT CAUSE</p>
                        <p className="text-xs bg-background p-2 rounded border border-border">
                          {err.short_description}
                        </p>
                      </div>
                    )}
                    {err.fix_steps && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Wrench className="w-3.5 h-3.5 text-primary" />
                          <p className="text-xs font-semibold text-primary">HOW TO FIX</p>
                        </div>
                        <div className="text-xs bg-primary/5 p-3 rounded border border-primary/20 whitespace-pre-wrap">
                          {err.fix_steps}
                        </div>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      Collected: {new Date(err.collected_at).toLocaleString()}
                      {err.execution_date && ` · Execution: ${new Date(err.execution_date).toLocaleString()}`}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
