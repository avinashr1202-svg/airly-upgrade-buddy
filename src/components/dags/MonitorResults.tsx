import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Activity, ChevronDown, ChevronRight, Wrench, CheckCircle, XCircle, Clock, AlertTriangle, Play, Pause, Filter } from "lucide-react";

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
  onRunSelected?: (dagNames: string[]) => void;
}

type StatusFilter = "all" | "new" | "running" | "success" | "failed";

export function MonitorResults({ results, onRunSelected }: MonitorResultsProps) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedDags, setSelectedDags] = useState<Set<string>>(new Set());

  // Deduplicate: show only latest result per dag_name
  const latestByDag = new Map<string, MonitorResult>();
  for (const r of results) {
    const existing = latestByDag.get(r.dag_name);
    if (!existing || new Date(r.collected_at) > new Date(existing.collected_at)) {
      latestByDag.set(r.dag_name, r);
    }
  }
  const uniqueResults = Array.from(latestByDag.values());

  const getEffectiveStatus = (r: MonitorResult): StatusFilter => {
    if (r.status === "not_started" || (!r.is_smoke_tested && r.status !== "success" && r.status !== "failed")) return "new";
    if (r.status === "running") return "running";
    if (r.status === "failed") return "failed";
    return "success";
  };

  const filtered = uniqueResults
    .filter((r) => r.dag_name.toLowerCase().includes(search.toLowerCase()))
    .filter((r) => statusFilter === "all" || getEffectiveStatus(r) === statusFilter);

  const counts = {
    all: uniqueResults.length,
    new: uniqueResults.filter((r) => getEffectiveStatus(r) === "new").length,
    running: uniqueResults.filter((r) => getEffectiveStatus(r) === "running").length,
    success: uniqueResults.filter((r) => getEffectiveStatus(r) === "success").length,
    failed: uniqueResults.filter((r) => getEffectiveStatus(r) === "failed").length,
  };

  const toggleSelect = (dagName: string) => {
    setSelectedDags((prev) => {
      const next = new Set(prev);
      if (next.has(dagName)) next.delete(dagName);
      else next.add(dagName);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedDags.size === filtered.length) {
      setSelectedDags(new Set());
    } else {
      setSelectedDags(new Set(filtered.map((r) => r.dag_name)));
    }
  };

  const statusIcon = (status: string, isSmokeT: boolean) => {
    const effective = status === "not_started" || (!isSmokeT && status !== "success" && status !== "failed")
      ? "new" : status;
    switch (effective) {
      case "success": return <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />;
      case "failed": return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
      case "running": return <Play className="w-4 h-4 text-blue-500 shrink-0" />;
      case "new": return <Clock className="w-4 h-4 text-yellow-500 shrink-0" />;
      default: return <Activity className="w-4 h-4 text-muted-foreground shrink-0" />;
    }
  };

  const statusLabel = (r: MonitorResult) => {
    const s = getEffectiveStatus(r);
    switch (s) {
      case "new": return "New";
      case "running": return "Running";
      case "success": return "Success";
      case "failed": return "Failed";
      default: return r.status;
    }
  };

  const statusBadgeVariant = (r: MonitorResult) => {
    const s = getEffectiveStatus(r);
    switch (s) {
      case "success": return "default";
      case "failed": return "destructive";
      case "new": return "outline";
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
      {/* Search + Filter bar */}
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by DAG name..."
              className="pl-8 h-8 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <Filter className="w-3 h-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({counts.all})</SelectItem>
              <SelectItem value="new">🆕 New ({counts.new})</SelectItem>
              <SelectItem value="running">▶ Running ({counts.running})</SelectItem>
              <SelectItem value="success">✅ Success ({counts.success})</SelectItem>
              <SelectItem value="failed">❌ Failed ({counts.failed})</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-3 text-[10px] text-muted-foreground">
            <span>{filtered.length} DAG(s)</span>
            <span>🆕 {counts.new}</span>
            <span>✅ {counts.success}</span>
            <span>❌ {counts.failed}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={selectAll}>
              {selectedDags.size === filtered.length ? "Deselect All" : "Select All"}
            </Button>
            {selectedDags.size > 0 && onRunSelected && (
              <Button size="sm" className="h-6 text-[10px] px-2 gap-1" onClick={() => onRunSelected(Array.from(selectedDags))}>
                <Play className="w-3 h-3" />
                Run {selectedDags.size} DAG(s)
              </Button>
            )}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {filtered.map((result) => {
            const isExpanded = expandedId === result.id;
            const isSelected = selectedDags.has(result.dag_name);
            return (
              <div key={result.id} className={`border rounded-lg overflow-hidden ${isSelected ? "border-primary" : "border-border"}`}>
                <button
                  className="w-full flex items-center gap-3 p-3 hover:bg-accent/30 transition-colors text-left"
                  onClick={() => setExpandedId(isExpanded ? null : result.id)}
                >
                  <input
                    type="checkbox"
                    className="rounded border-muted-foreground"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleSelect(result.dag_name);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  {statusIcon(result.status, result.is_smoke_tested)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold">{result.dag_name}</span>
                      <Badge variant={statusBadgeVariant(result) as any} className="text-[10px]">
                        {statusLabel(result)}
                      </Badge>
                      {!result.is_smoke_tested && getEffectiveStatus(result) !== "new" && (
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
                      {result.duration_seconds != null && <span>Duration: {result.duration_seconds}s</span>}
                      {result.last_run_at && <span>Last run: {new Date(result.last_run_at).toLocaleString()}</span>}
                      {!result.last_run_at && <span className="text-yellow-600">Never run</span>}
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