import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Activity, ChevronDown, ChevronRight, Wrench, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";

interface MonitorResult {
  id: string;
  template_id: string;
  run_id: string | null;
  dag_name: string;
  status: string;
  duration_seconds: number | null;
  last_run_at: string | null;
  is_smoke_tested: boolean;
  log_info: string | null;
  error_details: string | null;
  fix_steps: string | null;
  paths_covered: string | null;
  collected_at: string;
}

interface MonitorResultsProps {
  results: MonitorResult[];
}

export function MonitorResults({ results }: MonitorResultsProps) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = results.filter(
    (r) => r.dag_name.toLowerCase().includes(search.toLowerCase())
  );

  const statusIcon = (status: string) => {
    switch (status) {
      case "success": return <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />;
      case "failed": return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
      case "not_started": return <Clock className="w-4 h-4 text-muted-foreground shrink-0" />;
      case "not_tested": return <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />;
      default: return <Activity className="w-4 h-4 text-muted-foreground shrink-0" />;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "success": return "default";
      case "failed": return "destructive";
      default: return "secondary";
    }
  };

  if (results.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-sm p-8">
        <Activity className="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p>No monitor results yet.</p>
        <p className="text-xs mt-1">Run the Monitor DAG to start collecting DAG information.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by DAG name..."
            className="pl-8 h-8 text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-3 mt-1.5 text-[10px] text-muted-foreground">
          <span>{filtered.length} DAG(s)</span>
          <span>✅ {filtered.filter((r) => r.status === "success").length}</span>
          <span>❌ {filtered.filter((r) => r.status === "failed").length}</span>
          <span>⚠️ {filtered.filter((r) => !r.is_smoke_tested).length} not tested</span>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {filtered.map((result) => {
            const isExpanded = expandedId === result.id;
            return (
              <div key={result.id} className="border border-border rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 p-3 hover:bg-accent/30 transition-colors text-left"
                  onClick={() => setExpandedId(isExpanded ? null : result.id)}
                >
                  {statusIcon(result.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold">{result.dag_name}</span>
                      <Badge variant={statusBadge(result.status) as any} className="text-[10px]">
                        {result.status}
                      </Badge>
                      {!result.is_smoke_tested && (
                        <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                          Not Smoke Tested
                        </Badge>
                      )}
                      {result.is_smoke_tested && (
                        <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 border-green-500/20">
                          Smoke Tested ✓
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      {result.duration_seconds && <span>Duration: {result.duration_seconds}s</span>}
                      {result.last_run_at && <span>Last run: {new Date(result.last_run_at).toLocaleString()}</span>}
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
                    {result.paths_covered && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">PATHS COVERED</p>
                        <p className="text-xs bg-background p-2 rounded border border-border">{result.paths_covered}</p>
                      </div>
                    )}
                    {result.log_info && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">LOGS</p>
                        <pre className="text-xs font-mono bg-background p-2 rounded border border-border overflow-x-auto whitespace-pre-wrap max-h-48">
                          {result.log_info}
                        </pre>
                      </div>
                    )}
                    {result.error_details && (
                      <div>
                        <p className="text-xs font-semibold text-red-500 mb-1">ERROR DETAILS</p>
                        <pre className="text-xs font-mono bg-red-500/5 text-red-600 p-2 rounded border border-red-500/20 whitespace-pre-wrap max-h-48">
                          {result.error_details}
                        </pre>
                      </div>
                    )}
                    {result.fix_steps && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Wrench className="w-3.5 h-3.5 text-primary" />
                          <p className="text-xs font-semibold text-primary">HOW TO FIX</p>
                        </div>
                        <div className="text-xs bg-primary/5 p-3 rounded border border-primary/20 whitespace-pre-wrap">
                          {result.fix_steps}
                        </div>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      Collected: {new Date(result.collected_at).toLocaleString()}
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
