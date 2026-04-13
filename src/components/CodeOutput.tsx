import { FileCode2, Copy, Download, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface CodeOutputProps {
  code: string;
  isLoading: boolean;
  fileName?: string;
}

export function CodeOutput({ code, isLoading, fileName }: CodeOutputProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: "text/x-python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName ? fileName.replace(".py", "_airflow3.py") : "dag_airflow3.py";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <FileCode2 className="w-4 h-4 text-success" />
          <span className="text-sm font-medium text-foreground">Airflow 3.x Output</span>
        </div>
        {code && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground" onClick={handleCopy}>
              {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground" onClick={handleDownload}>
              <Download className="w-3 h-3 mr-1" />
              Download
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">AI is migrating your DAG...</span>
            </div>
          </div>
        ) : code ? (
          <pre className="code-editor p-4 text-foreground whitespace-pre-wrap">{code}</pre>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Migrated code will appear here
          </div>
        )}
      </div>
    </div>
  );
}
