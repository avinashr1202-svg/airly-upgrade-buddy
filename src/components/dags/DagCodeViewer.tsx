import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DagCodeViewerProps {
  code: string;
  name: string;
  onClose: () => void;
}

export function DagCodeViewer({ code, name, onClose }: DagCodeViewerProps) {
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{name} — Generated Code</DialogTitle>
          <DialogDescription>Review the generated DAG Python code below.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh]">
          <pre className="text-xs font-mono bg-muted/30 p-4 rounded border border-border whitespace-pre-wrap">
            {code}
          </pre>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
