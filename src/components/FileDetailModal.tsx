import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Download, Check, AlertTriangle, CheckCircle2, Shield, XCircle, Info, ArrowRight } from "lucide-react";
import { useState } from "react";
import type { FileEntry } from "@/types/pipeline";

interface FileDetailModalProps {
  file: FileEntry | null;
  open: boolean;
  onClose: () => void;
}

export function FileDetailModal({ file, open, onClose }: FileDetailModalProps) {
  const [copied, setCopied] = useState<string | null>(null);

  if (!file) return null;

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

  const finalCode = file.deployResult?.deployed_code || file.migrationResult?.fixed_code || "";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <span>{file.name}</span>
            {(file.stage === "completed" || file.stage === "ready_for_download") && <Badge className="bg-success/20 text-success text-xs">Completed</Badge>}
            {file.error && <Badge variant="destructive" className="text-xs">{file.error}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="code" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full rounded-none border-b border-border bg-card h-auto p-0 shrink-0">
            <TabsTrigger value="code" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs py-2.5">
              Code Comparison
            </TabsTrigger>
            <TabsTrigger value="changes" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent text-xs py-2.5">
              Changes ({(file.migrationResult?.changes?.length || 0) + (file.deployResult?.changes?.length || 0)})
            </TabsTrigger>
            <TabsTrigger value="tests" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-success data-[state=active]:bg-transparent text-xs py-2.5">
              Test Results
            </TabsTrigger>
          </TabsList>

          <TabsContent value="code" className="flex-1 m-0 overflow-hidden">
            <div className="flex h-full">
              {/* Input */}
              <div className="flex-1 flex flex-col border-r border-border min-w-0">
                <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
                  <span className="text-xs font-semibold text-muted-foreground">Airflow 2.x (Original)</span>
                </div>
                <pre className="flex-1 overflow-auto scrollbar-thin code-editor p-4 text-foreground text-xs whitespace-pre-wrap">{file.inputCode}</pre>
              </div>
              {/* Output */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
                  <span className="text-xs font-semibold text-success">Airflow 3.x (Output)</span>
                  {finalCode && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => handleCopy(finalCode, "output")}>
                        {copied === "output" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => handleDownload(finalCode, "airflow3")}>
                        <Download className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <pre className="flex-1 overflow-auto scrollbar-thin code-editor p-4 text-foreground text-xs whitespace-pre-wrap">
                  {finalCode || "No output yet"}
                </pre>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="changes" className="flex-1 m-0 overflow-auto scrollbar-thin p-4">
            {/* Migration changes */}
            {file.migrationResult && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <RiskIcon level={file.migrationResult.risk_level} />
                  <span className="text-sm font-semibold text-foreground">Migration Changes</span>
                  <Badge variant="secondary" className="text-xs ml-auto">{file.migrationResult.changes?.length || 0}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{file.migrationResult.summary}</p>
                {file.migrationResult.warnings?.length > 0 && (
                  <div className="bg-warning/10 rounded-md p-3 mb-3">
                    {file.migrationResult.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-warning flex items-start gap-1.5">
                        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {w}
                      </p>
                    ))}
                  </div>
                )}
                <ChangesList changes={file.migrationResult.changes} />
              </div>
            )}

            {/* Deploy changes */}
            {file.deployResult && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-accent" />
                  <span className="text-sm font-semibold text-foreground">Python 3.13 Changes</span>
                  <Badge variant="secondary" className="text-xs ml-auto">{file.deployResult.changes?.length || 0}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{file.deployResult.summary}</p>
                <ChangesList changes={file.deployResult.changes} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="tests" className="flex-1 m-0 overflow-auto scrollbar-thin p-4">
            {file.testResult ? (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <StatusBadge status={file.testResult.overall_status} />
                  <span className="text-sm font-semibold text-foreground">Confidence: {file.testResult.confidence_score}%</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">{file.testResult.summary}</p>

                <div className="space-y-2">
                  {file.testResult.tests?.map((test, i) => (
                    <div key={i} className="bg-muted rounded-md p-3">
                      <div className="flex items-center gap-2 mb-1">
                        {test.status === "pass" ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                        ) : test.status === "fail" ? (
                          <XCircle className="w-3.5 h-3.5 text-destructive" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                        )}
                        <span className="text-xs font-medium text-foreground">{test.name}</span>
                        <Badge variant="outline" className="text-[9px] ml-auto">{test.category}</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground ml-5">{test.details}</p>
                      {test.fix_suggestion && (
                        <p className="text-[11px] text-warning ml-5 mt-1">💡 {test.fix_suggestion}</p>
                      )}
                    </div>
                  ))}
                </div>

                {file.testResult.remaining_issues?.length > 0 && (
                  <div className="mt-4 bg-warning/10 rounded-md p-3">
                    <span className="text-xs font-semibold text-warning block mb-2">Remaining Issues</span>
                    {file.testResult.remaining_issues.map((issue, i) => (
                      <p key={i} className="text-xs text-muted-foreground">• {issue}</p>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2">
                <Info className="w-5 h-5" />
                <span>Test results will appear after testing stage completes</span>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function RiskIcon({ level }: { level: string }) {
  const color = level === "low" ? "text-success" : level === "high" ? "text-destructive" : "text-warning";
  const Icon = level === "low" ? CheckCircle2 : level === "high" ? AlertTriangle : Shield;
  return <Icon className={`w-4 h-4 ${color}`} />;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "pass") return <Badge className="bg-success/20 text-success">PASS</Badge>;
  if (status === "fail") return <Badge variant="destructive">FAIL</Badge>;
  return <Badge className="bg-warning/20 text-warning">WARNING</Badge>;
}

function ChangesList({ changes }: { changes?: { line: string; before: string; after: string; reason: string }[] }) {
  if (!changes?.length) return <p className="text-xs text-muted-foreground">No changes recorded.</p>;
  return (
    <div className="space-y-2">
      {changes.map((change, i) => (
        <div key={i} className="bg-muted rounded-md p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="outline" className="text-[9px] font-mono">L{change.line}</Badge>
            <span className="text-[11px] text-muted-foreground">{change.reason}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="text-destructive line-through truncate flex-1">{change.before}</span>
            <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="text-success truncate flex-1">{change.after}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
