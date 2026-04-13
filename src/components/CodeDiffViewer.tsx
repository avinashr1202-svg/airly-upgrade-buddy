import { useRef, useCallback, useMemo } from "react";
import { Copy, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import type { FileEntry, Change } from "@/types/pipeline";

interface CodeDiffViewerProps {
  file: FileEntry;
}

interface DiffLine {
  lineNum: number;
  oldLine: string;
  newLine: string;
  type: "unchanged" | "modified" | "added" | "removed";
}

function computeDiffLines(oldCode: string, newCode: string, changes: Change[]): DiffLine[] {
  const oldLines = oldCode.split("\n");
  const newLines = newCode.split("\n");
  const maxLen = Math.max(oldLines.length, newLines.length);

  // Build a set of changed line numbers for quick lookup
  const changedLineNums = new Set<number>();
  changes?.forEach((c) => {
    const num = parseInt(c.line, 10);
    if (!isNaN(num)) changedLineNums.add(num);
  });

  const result: DiffLine[] = [];
  for (let i = 0; i < maxLen; i++) {
    const oldLine = i < oldLines.length ? oldLines[i] : "";
    const newLine = i < newLines.length ? newLines[i] : "";
    const lineNum = i + 1;

    let type: DiffLine["type"] = "unchanged";
    if (changedLineNums.has(lineNum)) {
      type = "modified";
    } else if (i >= oldLines.length) {
      type = "added";
    } else if (i >= newLines.length) {
      type = "removed";
    } else if (oldLine !== newLine) {
      type = "modified";
    }

    result.push({ lineNum, oldLine, newLine, type });
  }
  return result;
}

export function CodeDiffViewer({ file }: CodeDiffViewerProps) {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  const [copied, setCopied] = useState<string | null>(null);

  const finalCode = file.deployResult?.deployed_code || file.migrationResult?.fixed_code || "";
  const allChanges = [
    ...(file.migrationResult?.changes || []),
    ...(file.deployResult?.changes || []),
  ];

  const diffLines = useMemo(
    () => computeDiffLines(file.inputCode, finalCode, allChanges),
    [file.inputCode, finalCode, allChanges]
  );

  const handleScroll = useCallback((source: "left" | "right") => {
    if (syncing.current) return;
    syncing.current = true;
    const from = source === "left" ? leftRef.current : rightRef.current;
    const to = source === "left" ? rightRef.current : leftRef.current;
    if (from && to) {
      to.scrollTop = from.scrollTop;
      to.scrollLeft = from.scrollLeft;
    }
    requestAnimationFrame(() => {
      syncing.current = false;
    });
  }, []);

  const handleCopy = async (code: string, label: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDownload = (code: string, suffix: string) => {
    const blob = new Blob([code], { type: "text/x-python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name.replace(".py", `_${suffix}.py`);
    a.click();
    URL.revokeObjectURL(url);
  };

  const bgClass = (type: DiffLine["type"], side: "old" | "new") => {
    if (type === "modified") return side === "old" ? "bg-destructive/10" : "bg-success/10";
    if (type === "added") return side === "new" ? "bg-success/10" : "";
    if (type === "removed") return side === "old" ? "bg-destructive/10" : "";
    return "";
  };

  const textClass = (type: DiffLine["type"], side: "old" | "new") => {
    if (type === "modified") return side === "old" ? "text-destructive" : "text-success";
    if (type === "added" && side === "new") return "text-success";
    if (type === "removed" && side === "old") return "text-destructive";
    return "text-foreground";
  };

  return (
    <Tabs defaultValue="code" className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-card/50 px-4 shrink-0">
        <TabsList className="bg-transparent h-auto p-0 gap-0">
          <TabsTrigger value="code" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs py-2.5 px-4">
            Code Comparison
          </TabsTrigger>
          <TabsTrigger value="changes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent text-xs py-2.5 px-4">
            Changes ({allChanges.length})
          </TabsTrigger>
          {file.testResult && (
            <TabsTrigger value="tests" className="rounded-none border-b-2 border-transparent data-[state=active]:border-success data-[state=active]:bg-transparent text-xs py-2.5 px-4">
              Tests
            </TabsTrigger>
          )}
        </TabsList>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-destructive/20 border border-destructive/30" /> Removed</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-success/20 border border-success/30" /> Added/Changed</span>
        </div>
      </div>

      <TabsContent value="code" className="flex-1 m-0 overflow-hidden">
        <div className="flex h-full">
          {/* Left: Original */}
          <div className="flex-1 flex flex-col border-r border-border min-w-0">
            <div className="flex items-center justify-between px-4 py-1.5 border-b border-border bg-muted/30 shrink-0">
              <span className="text-[11px] font-semibold text-muted-foreground">Airflow 2.x — Original</span>
            </div>
            <div
              ref={leftRef}
              onScroll={() => handleScroll("left")}
              className="flex-1 overflow-auto scrollbar-thin font-mono text-xs leading-5"
            >
              {diffLines.map((line) => (
                <div key={`old-${line.lineNum}`} className={`flex min-h-[20px] ${bgClass(line.type, "old")}`}>
                  <span className="w-10 shrink-0 text-right pr-2 text-muted-foreground/50 select-none text-[10px] leading-5 border-r border-border/50">
                    {line.type !== "added" ? line.lineNum : ""}
                  </span>
                  <pre className={`flex-1 pl-3 pr-2 whitespace-pre ${textClass(line.type, "old")}`}>
                    {line.type === "removed" ? `- ${line.oldLine}` : line.oldLine}
                  </pre>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Converted */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center justify-between px-4 py-1.5 border-b border-border bg-muted/30 shrink-0">
              <span className="text-[11px] font-semibold text-success">Airflow 3.x — Migrated</span>
              {finalCode && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5" onClick={() => handleCopy(finalCode, "output")}>
                    {copied === "output" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5" onClick={() => handleDownload(finalCode, "airflow3")}>
                    <Download className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
            <div
              ref={rightRef}
              onScroll={() => handleScroll("right")}
              className="flex-1 overflow-auto scrollbar-thin font-mono text-xs leading-5"
            >
              {diffLines.map((line) => (
                <div key={`new-${line.lineNum}`} className={`flex min-h-[20px] ${bgClass(line.type, "new")}`}>
                  <span className="w-10 shrink-0 text-right pr-2 text-muted-foreground/50 select-none text-[10px] leading-5 border-r border-border/50">
                    {line.type !== "removed" ? line.lineNum : ""}
                  </span>
                  <pre className={`flex-1 pl-3 pr-2 whitespace-pre ${textClass(line.type, "new")}`}>
                    {line.type === "added" ? `+ ${line.newLine}` : line.newLine}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="changes" className="flex-1 m-0 overflow-auto scrollbar-thin p-4">
        {file.migrationResult && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-foreground">Migration Changes</span>
              <Badge variant="secondary" className="text-xs ml-auto">{file.migrationResult.changes?.length || 0}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{file.migrationResult.summary}</p>
            {file.migrationResult.warnings?.length > 0 && (
              <div className="bg-warning/10 rounded-md p-3 mb-3 space-y-1">
                {file.migrationResult.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-warning">⚠ {w}</p>
                ))}
              </div>
            )}
            <ChangesList changes={file.migrationResult.changes} />
          </div>
        )}
        {file.deployResult && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-foreground">Python 3.13 Changes</span>
              <Badge variant="secondary" className="text-xs ml-auto">{file.deployResult.changes?.length || 0}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{file.deployResult.summary}</p>
            <ChangesList changes={file.deployResult.changes} />
          </div>
        )}
      </TabsContent>

      {file.testResult && (
        <TabsContent value="tests" className="flex-1 m-0 overflow-auto scrollbar-thin p-4">
          <div className="flex items-center gap-3 mb-4">
            <Badge className={file.testResult.overall_status === "pass" ? "bg-success/20 text-success" : file.testResult.overall_status === "fail" ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-warning"}>
              {file.testResult.overall_status.toUpperCase()}
            </Badge>
            <span className="text-sm font-semibold text-foreground">Confidence: {file.testResult.confidence_score}%</span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">{file.testResult.summary}</p>
          <div className="space-y-2">
            {file.testResult.tests?.map((test, i) => (
              <div key={i} className="bg-muted rounded-md p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${test.status === "pass" ? "bg-success" : test.status === "fail" ? "bg-destructive" : "bg-warning"}`} />
                  <span className="text-xs font-medium text-foreground">{test.name}</span>
                  <Badge variant="outline" className="text-[9px] ml-auto">{test.category}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground ml-4">{test.details}</p>
                {test.fix_suggestion && <p className="text-[11px] text-warning ml-4 mt-1">💡 {test.fix_suggestion}</p>}
              </div>
            ))}
          </div>
        </TabsContent>
      )}
    </Tabs>
  );
}

function ChangesList({ changes }: { changes?: Change[] }) {
  if (!changes?.length) return <p className="text-xs text-muted-foreground">No changes recorded.</p>;
  return (
    <div className="space-y-2">
      {changes.map((change, i) => (
        <div key={i} className="bg-muted rounded-md p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="outline" className="text-[9px] font-mono">L{change.line}</Badge>
            <span className="text-[11px] text-muted-foreground">{change.reason}</span>
          </div>
          <div className="space-y-0.5 font-mono text-[11px]">
            <div className="bg-destructive/10 px-2 py-0.5 rounded text-destructive">- {change.before}</div>
            <div className="bg-success/10 px-2 py-0.5 rounded text-success">+ {change.after}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
