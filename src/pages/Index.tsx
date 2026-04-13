import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { CodeInput } from "@/components/CodeInput";
import { CodeOutput } from "@/components/CodeOutput";
import { ChangesList, type MigrationResult } from "@/components/ChangesList";
import { MigrationRules } from "@/components/MigrationRules";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const [inputCode, setInputCode] = useState("");
  const [outputCode, setOutputCode] = useState("");
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("changes");

  const handleMigrate = async () => {
    if (!inputCode.trim()) {
      toast.error("Please paste or upload your Airflow 2.x DAG code first.");
      return;
    }

    setIsLoading(true);
    setOutputCode("");
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("migrate-dag", {
        body: { code: inputCode, mode: "migrate" },
      });

      if (error) {
        throw new Error(error.message || "Migration failed");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setOutputCode(data.fixed_code || "");
      setResult(data);
      setActiveTab("changes");
      toast.success(`Migration complete — ${data.changes?.length || 0} changes applied`);
    } catch (err: any) {
      console.error("Migration error:", err);
      toast.error(err.message || "Migration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setInputCode("");
    setOutputCode("");
    setResult(null);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />

      {/* Action Bar */}
      <div className="flex items-center justify-center gap-3 px-6 py-3 border-b border-border bg-card">
        <Button
          onClick={handleMigrate}
          disabled={isLoading || !inputCode.trim()}
          className="gradient-primary text-primary-foreground font-semibold px-6 glow-primary hover:opacity-90 transition-opacity"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
              Migrating...
            </>
          ) : (
            <>
              <ArrowRight className="w-4 h-4 mr-2" />
              Migrate to 3.x
            </>
          )}
        </Button>
        <Button variant="outline" size="sm" onClick={handleReset} disabled={isLoading} className="text-muted-foreground">
          <RotateCcw className="w-3 h-3 mr-1" />
          Reset
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Input */}
        <div className="flex-1 border-r border-border flex flex-col min-w-0">
          <CodeInput code={inputCode} setCode={setInputCode} isLoading={isLoading} />
        </div>

        {/* Center: Output */}
        <div className="flex-1 border-r border-border flex flex-col min-w-0">
          <CodeOutput code={outputCode} isLoading={isLoading} />
        </div>

        {/* Right: Analysis Panel */}
        <div className="w-80 flex flex-col min-w-0 shrink-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
            <TabsList className="w-full rounded-none border-b border-border bg-card h-auto p-0">
              <TabsTrigger
                value="changes"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs py-2.5"
              >
                Changes
              </TabsTrigger>
              <TabsTrigger
                value="rules"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent text-xs py-2.5"
              >
                Rules
              </TabsTrigger>
            </TabsList>
            <TabsContent value="changes" className="flex-1 m-0 overflow-hidden">
              <ChangesList result={result} isLoading={isLoading} />
            </TabsContent>
            <TabsContent value="rules" className="flex-1 m-0 overflow-hidden">
              <MigrationRules />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Index;
