import { AlertTriangle, CheckCircle2, Info, ArrowRight, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface Change {
  line: string;
  before: string;
  after: string;
  reason: string;
}

export interface MigrationResult {
  fixed_code: string;
  changes: Change[];
  risk_level: string;
  summary: string;
  warnings: string[];
}

interface ChangesListProps {
  result: MigrationResult | null;
  isLoading: boolean;
}

export function ChangesList({ result, isLoading }: ChangesListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Analyzing changes...</span>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm p-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <Info className="w-5 h-5" />
          <span>Migration analysis will appear here</span>
        </div>
      </div>
    );
  }

  const riskColor = result.risk_level === "low" ? "text-success" :
    result.risk_level === "high" ? "text-destructive" : "text-warning";
  const RiskIcon = result.risk_level === "low" ? CheckCircle2 :
    result.risk_level === "high" ? AlertTriangle : Shield;

  return (
    <div className="flex flex-col h-full overflow-auto scrollbar-thin">
      {/* Summary */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <RiskIcon className={`w-4 h-4 ${riskColor}`} />
          <span className={`text-sm font-semibold ${riskColor}`}>
            Risk: {result.risk_level?.toUpperCase()}
          </span>
          <Badge variant="secondary" className="ml-auto text-xs">
            {result.changes?.length || 0} changes
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{result.summary}</p>
      </div>

      {/* Warnings */}
      {result.warnings && result.warnings.length > 0 && (
        <div className="p-4 border-b border-border">
          <span className="text-xs font-semibold text-warning flex items-center gap-1 mb-2">
            <AlertTriangle className="w-3 h-3" /> Warnings
          </span>
          {result.warnings.map((w, i) => (
            <p key={i} className="text-xs text-muted-foreground mb-1">• {w}</p>
          ))}
        </div>
      )}

      {/* Changes */}
      <div className="flex-1 p-4">
        <span className="text-xs font-semibold text-foreground mb-3 block">Changes Applied</span>
        <div className="space-y-3">
          {result.changes?.map((change, i) => (
            <div key={i} className="bg-muted rounded-md p-3 animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="text-[10px] font-mono">L{change.line}</Badge>
                <span className="text-xs text-muted-foreground">{change.reason}</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-destructive line-through truncate flex-1">{change.before}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-success truncate flex-1">{change.after}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
