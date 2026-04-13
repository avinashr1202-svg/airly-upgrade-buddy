import { Play, SkipForward, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FileEntry } from "@/types/pipeline";

interface PipelineControlsProps {
  files: FileEntry[];
  onMigrateAll: () => void;
  onContinuePipeline: () => void;
  onReset: () => void;
  isPaused: boolean;
  currentStage: string;
}

export function PipelineControls({ files, onMigrateAll, onContinuePipeline, onReset, isPaused, currentStage }: PipelineControlsProps) {
  const anyProcessing = files.some((f) =>
    f.stage === "migration" || f.stage === "deployment" || f.stage === "testing"
  );
  const hasPendingFiles = files.some((f) => f.inputCode.trim() && f.stage === "idle");
  const allCompleted = files.length > 0 && files.every((f) => f.stage === "completed");

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50">
      {/* Stage indicator */}
      <div className="flex items-center gap-2 flex-1">
        <StageIndicator label="Migration" active={currentStage === "migration"} done={["deployment", "testing", "completed"].some((s) => files.some((f) => f.stage.startsWith(s.split("_")[0])))} />
        <div className="w-6 h-px bg-border" />
        <StageIndicator label="Deployment" active={currentStage === "deployment"} done={["testing", "completed"].some((s) => files.some((f) => f.stage.startsWith(s.split("_")[0])))} />
        <div className="w-6 h-px bg-border" />
        <StageIndicator label="Testing" active={currentStage === "testing"} done={allCompleted} />
      </div>

      <div className="flex items-center gap-2">
        {isPaused && (
          <Button
            onClick={onContinuePipeline}
            className="gradient-primary text-primary-foreground font-semibold px-4 glow-primary hover:opacity-90 text-xs"
            size="sm"
          >
            <SkipForward className="w-3.5 h-3.5 mr-1" />
            Continue to {currentStage === "migration" ? "Deployment" : "Testing"}
          </Button>
        )}

        {!isPaused && hasPendingFiles && (
          <Button
            onClick={onMigrateAll}
            disabled={anyProcessing}
            className="gradient-primary text-primary-foreground font-semibold px-4 glow-primary hover:opacity-90 text-xs"
            size="sm"
          >
            {anyProcessing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-1" />
                Processing...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 mr-1" />
                Start Pipeline ({files.filter((f) => f.stage === "idle" && f.inputCode.trim()).length} files)
              </>
            )}
          </Button>
        )}

        <Button variant="outline" size="sm" onClick={onReset} disabled={anyProcessing} className="text-xs text-muted-foreground">
          <RotateCcw className="w-3 h-3 mr-1" />
          Reset
        </Button>
      </div>
    </div>
  );
}

function StageIndicator({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium ${active ? "text-primary" : done ? "text-success" : "text-muted-foreground"}`}>
      <div className={`w-2 h-2 rounded-full ${active ? "bg-primary animate-pulse" : done ? "bg-success" : "bg-muted-foreground/30"}`} />
      {label}
    </div>
  );
}
