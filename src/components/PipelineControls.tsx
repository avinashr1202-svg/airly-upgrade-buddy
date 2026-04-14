import { Play, SkipForward, RotateCcw, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FileEntry } from "@/types/pipeline";

interface PipelineControlsProps {
  files: FileEntry[];
  onStartMigration: () => void;
  onStartTesting: () => void;
  onReset: () => void;
  onEnterSelectionMode: (mode: "migration" | "testing") => void;
  selectionMode: "migration" | "testing" | null;
  selectedCount: number;
  anyProcessing: boolean;
}

export function PipelineControls({
  files,
  onStartMigration,
  onStartTesting,
  onReset,
  onEnterSelectionMode,
  selectionMode,
  selectedCount,
  anyProcessing,
}: PipelineControlsProps) {
  const hasDeployed = files.some((f) => f.stage === "deployed");
  const hasMigrated = files.some((f) => f.stage === "migration_done");
  const allCompleted = files.length > 0 && files.every((f) => f.stage === "completed" || f.stage === "ready_for_download");

  const currentStage = (() => {
    if (files.some((f) => f.stage === "testing")) return "testing";
    if (files.some((f) => f.stage === "migration")) return "migration";
    if (hasMigrated || files.some((f) => f.stage === "completed")) return "post-migration";
    if (hasDeployed) return "deployed";
    return "";
  })();

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 px-3 md:px-4 py-2.5 md:py-3 border-b border-border bg-card/50">
      {/* Stage indicator */}
      <div className="flex items-center gap-2 flex-1 overflow-x-auto scrollbar-thin">
        <StageIndicator
          label="Deployment"
          active={currentStage === "deployed"}
          done={files.length > 0}
        />
        <div className="w-4 md:w-6 h-px bg-border shrink-0" />
        <StageIndicator
          label="Migration"
          active={currentStage === "migration"}
          done={hasMigrated || allCompleted}
        />
        <div className="w-4 md:w-6 h-px bg-border shrink-0" />
        <StageIndicator
          label="Testing"
          active={currentStage === "testing"}
          done={allCompleted}
        />
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
        {selectionMode === "migration" && (
          <Button
            onClick={onStartMigration}
            disabled={selectedCount === 0 || anyProcessing}
            className="gradient-primary text-primary-foreground font-semibold px-3 md:px-4 glow-primary hover:opacity-90 text-xs transition-all duration-200 active:scale-95"
            size="sm"
          >
            <Play className="w-3.5 h-3.5 mr-1" />
            Migrate {selectedCount} file{selectedCount !== 1 ? "s" : ""}
          </Button>
        )}

        {selectionMode === "testing" && (
          <Button
            onClick={onStartTesting}
            disabled={selectedCount === 0 || anyProcessing}
            className="gradient-primary text-primary-foreground font-semibold px-3 md:px-4 glow-primary hover:opacity-90 text-xs transition-all duration-200 active:scale-95"
            size="sm"
          >
            <Play className="w-3.5 h-3.5 mr-1" />
            Test {selectedCount} file{selectedCount !== 1 ? "s" : ""}
          </Button>
        )}

        {!selectionMode && hasDeployed && !anyProcessing && (
          <Button
            onClick={() => onEnterSelectionMode("migration")}
            className="gradient-primary text-primary-foreground font-semibold px-3 md:px-4 glow-primary hover:opacity-90 text-xs transition-all duration-200 active:scale-95"
            size="sm"
          >
            <CheckSquare className="w-3.5 h-3.5 mr-1" />
            Select & Migrate
          </Button>
        )}

        {!selectionMode && hasMigrated && !anyProcessing && (
          <Button
            onClick={() => onEnterSelectionMode("testing")}
            variant="outline"
            size="sm"
            className="text-xs transition-all duration-200 active:scale-95"
          >
            <CheckSquare className="w-3.5 h-3.5 mr-1" />
            Select & Test
          </Button>
        )}

        {anyProcessing && !selectionMode && (
          <Button disabled size="sm" className="text-xs">
            <div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-1" />
            Processing...
          </Button>
        )}

        <Button variant="outline" size="sm" onClick={onReset} disabled={anyProcessing} className="text-xs text-muted-foreground transition-all duration-200 active:scale-95">
          <RotateCcw className="w-3 h-3 mr-1" />
          Reset
        </Button>
      </div>
    </div>
  );
}

function StageIndicator({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 text-[10px] md:text-xs font-medium whitespace-nowrap transition-colors duration-300 ${active ? "text-primary" : done ? "text-success" : "text-muted-foreground"}`}>
      <div className={`w-2 h-2 rounded-full transition-all duration-300 ${active ? "bg-primary animate-pulse shadow-[0_0_6px_hsl(var(--primary)/0.5)]" : done ? "bg-success" : "bg-muted-foreground/30"}`} />
      {label}
    </div>
  );
}
