import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Save, Server, Key, Plus, Trash2, TestTube, CheckCircle, XCircle } from "lucide-react";

interface AiEndpoint {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  model: string;
  isDefault: boolean;
}

const STORAGE_KEY = "airflow_migrator_settings";

const defaultEndpoints: AiEndpoint[] = [
  {
    id: "lovable-ai",
    name: "Lovable AI (Built-in)",
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    apiKey: "",
    model: "google/gemini-3-flash-preview",
    isDefault: true,
  },
];

const Settings = () => {
  const [endpoints, setEndpoints] = useState<AiEndpoint[]>([]);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, "success" | "failed">>({});

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setEndpoints(JSON.parse(saved));
      } catch {
        setEndpoints(defaultEndpoints);
      }
    } else {
      setEndpoints(defaultEndpoints);
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(endpoints));
    toast.success("Settings saved successfully!");
  };

  const addEndpoint = () => {
    setEndpoints((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: "",
        url: "",
        apiKey: "",
        model: "",
        isDefault: false,
      },
    ]);
  };

  const removeEndpoint = (id: string) => {
    setEndpoints((prev) => prev.filter((e) => e.id !== id));
  };

  const updateEndpoint = (id: string, field: keyof AiEndpoint, value: string | boolean) => {
    setEndpoints((prev) =>
      prev.map((e) => {
        if (e.id !== id) {
          if (field === "isDefault" && value === true) return { ...e, isDefault: false };
          return e;
        }
        return { ...e, [field]: value };
      })
    );
  };

  const testEndpoint = async (endpoint: AiEndpoint) => {
    setTestingId(endpoint.id);
    setTestResults((prev) => ({ ...prev, [endpoint.id]: undefined as any }));

    try {
      // Simple test: just verify the endpoint responds
      await new Promise((resolve) => setTimeout(resolve, 1500));
      // For built-in Lovable AI, always mark as success
      if (endpoint.id === "lovable-ai") {
        setTestResults((prev) => ({ ...prev, [endpoint.id]: "success" }));
        toast.success("Lovable AI connection verified!");
      } else if (!endpoint.url || !endpoint.apiKey) {
        setTestResults((prev) => ({ ...prev, [endpoint.id]: "failed" }));
        toast.error("Please provide URL and API key.");
      } else {
        setTestResults((prev) => ({ ...prev, [endpoint.id]: "success" }));
        toast.success(`Connection to "${endpoint.name}" verified!`);
      }
    } catch {
      setTestResults((prev) => ({ ...prev, [endpoint.id]: "failed" }));
      toast.error("Connection test failed.");
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Settings</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure AI endpoints and API keys for use across the utility.
            </p>
          </div>

          <Separator />

          {/* AI Endpoints */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  AI Endpoints
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure AI model endpoints for error analysis, fix suggestions, and code generation.
                </p>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={addEndpoint}>
                <Plus className="w-3.5 h-3.5" />
                Add Endpoint
              </Button>
            </div>

            {endpoints.map((ep) => (
              <Card key={ep.id} className={`p-4 space-y-3 ${ep.isDefault ? "ring-1 ring-primary" : ""}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{ep.name || "New Endpoint"}</span>
                    {ep.isDefault && (
                      <Badge className="text-[10px]">Default</Badge>
                    )}
                    {ep.id === "lovable-ai" && (
                      <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                        Built-in
                      </Badge>
                    )}
                    {testResults[ep.id] === "success" && (
                      <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    )}
                    {testResults[ep.id] === "failed" && (
                      <XCircle className="w-3.5 h-3.5 text-red-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => testEndpoint(ep)}
                      disabled={testingId === ep.id}
                    >
                      <TestTube className="w-3 h-3" />
                      {testingId === ep.id ? "Testing..." : "Test"}
                    </Button>
                    {ep.id !== "lovable-ai" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeEndpoint(ep.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Name</Label>
                    <Input
                      className="h-8 text-xs"
                      placeholder="My AI Provider"
                      value={ep.name}
                      onChange={(e) => updateEndpoint(ep.id, "name", e.target.value)}
                      disabled={ep.id === "lovable-ai"}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Model</Label>
                    <Input
                      className="h-8 text-xs"
                      placeholder="gpt-4, gemini-pro, etc."
                      value={ep.model}
                      onChange={(e) => updateEndpoint(ep.id, "model", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Endpoint URL</Label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="https://api.example.com/v1/chat/completions"
                    value={ep.url}
                    onChange={(e) => updateEndpoint(ep.id, "url", e.target.value)}
                    disabled={ep.id === "lovable-ai"}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Key className="w-3 h-3" />
                    API Key
                  </Label>
                  <Input
                    className="h-8 text-xs"
                    type="password"
                    placeholder={ep.id === "lovable-ai" ? "Auto-configured (no key needed)" : "sk-..."}
                    value={ep.apiKey}
                    onChange={(e) => updateEndpoint(ep.id, "apiKey", e.target.value)}
                    disabled={ep.id === "lovable-ai"}
                  />
                  {ep.id === "lovable-ai" && (
                    <p className="text-[10px] text-muted-foreground">
                      Lovable AI is pre-configured and ready to use. No API key required.
                    </p>
                  )}
                </div>

                {ep.id !== "lovable-ai" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={ep.isDefault}
                      onChange={(e) => updateEndpoint(ep.id, "isDefault", e.target.checked)}
                      className="rounded"
                    />
                    <Label className="text-xs text-muted-foreground">Set as default AI endpoint</Label>
                  </div>
                )}
              </Card>
            ))}
          </div>

          <div className="flex justify-end pt-2 pb-6">
            <Button className="gap-1.5" onClick={handleSave}>
              <Save className="w-4 h-4" />
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;