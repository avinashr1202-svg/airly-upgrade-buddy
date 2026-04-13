import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, ArrowRightLeft, AlertCircle, Zap, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { CustomRule } from "@/types/pipeline";

const BUILTIN_RULES = [
  {
    category: "Import Paths",
    icon: ArrowRightLeft,
    items: [
      { from: "airflow.operators.python_operator", to: "airflow.operators.python" },
      { from: "airflow.operators.bash_operator", to: "airflow.operators.bash" },
      { from: "airflow.operators.dummy_operator", to: "airflow.operators.empty" },
      { from: "airflow.sensors.external_task_sensor", to: "airflow.sensors.external_task" },
    ],
  },
  {
    category: "Deprecated Parameters",
    icon: AlertCircle,
    items: [
      { from: "schedule_interval='@daily'", to: "schedule='@daily'" },
      { from: "provide_context=True", to: "(removed)" },
      { from: "task_concurrency=N", to: "max_active_tis_per_dag=N" },
    ],
  },
  {
    category: "Date & Context",
    icon: Zap,
    items: [
      { from: "days_ago(N)", to: "pendulum.today().subtract(days=N)" },
      { from: "execution_date", to: "logical_date" },
      { from: "next_execution_date", to: "data_interval_end" },
    ],
  },
  {
    category: "Operators & Patterns",
    icon: BookOpen,
    items: [
      { from: "SubDagOperator", to: "TaskGroup" },
      { from: "DummyOperator", to: "EmptyOperator" },
    ],
  },
];

export function CustomRulesPanel() {
  const [customRules, setCustomRules] = useState<CustomRule[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFrom, setNewFrom] = useState("");
  const [newTo, setNewTo] = useState("");
  const [newCategory, setNewCategory] = useState("Custom");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => {
    loadCustomRules();
  }, []);

  async function loadCustomRules() {
    const { data } = await supabase.from("custom_rules").select("*").order("created_at", { ascending: false });
    if (data) setCustomRules(data as CustomRule[]);
  }

  async function addRule() {
    if (!newFrom.trim() || !newTo.trim()) {
      toast.error("Both 'from' and 'to' patterns are required");
      return;
    }
    const { error } = await supabase.from("custom_rules").insert({
      from_pattern: newFrom,
      to_pattern: newTo,
      category: newCategory || "Custom",
      description: newDesc || null,
    });
    if (error) {
      toast.error("Failed to save rule");
      return;
    }
    toast.success("Rule added");
    setNewFrom("");
    setNewTo("");
    setNewDesc("");
    setShowAddForm(false);
    loadCustomRules();
  }

  async function deleteRule(id: string) {
    await supabase.from("custom_rules").delete().eq("id", id);
    setCustomRules((prev) => prev.filter((r) => r.id !== id));
    toast.success("Rule removed");
  }

  return (
    <div className="flex flex-col h-full overflow-auto scrollbar-thin">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-accent" />
            <span className="text-sm font-semibold text-foreground">Migration Rules</span>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="w-3 h-3 mr-1" />
            Add Rule
          </Button>
        </div>
      </div>

      {showAddForm && (
        <div className="p-4 border-b border-border bg-muted/30 space-y-2">
          <Input placeholder="Category (e.g. Custom)" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="text-xs h-8" />
          <Input placeholder="From pattern" value={newFrom} onChange={(e) => setNewFrom(e.target.value)} className="text-xs h-8" />
          <Input placeholder="To pattern" value={newTo} onChange={(e) => setNewTo(e.target.value)} className="text-xs h-8" />
          <Input placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="text-xs h-8" />
          <div className="flex gap-2">
            <Button size="sm" className="text-xs h-7 flex-1" onClick={addRule}>Save</Button>
            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setShowAddForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="p-4 space-y-5">
        {/* Custom rules */}
        {customRules.length > 0 && (
          <div>
            <span className="text-xs font-semibold text-accent block mb-2">Custom Rules</span>
            <div className="space-y-1.5">
              {customRules.map((rule) => (
                <div key={rule.id} className="bg-accent/10 border border-accent/20 rounded px-3 py-2 group relative">
                  <div className="text-[10px] text-muted-foreground mb-0.5">{rule.category}</div>
                  <div className="text-[11px] font-mono text-destructive/80 line-through">{rule.from_pattern}</div>
                  <div className="text-[11px] font-mono text-success">{rule.to_pattern}</div>
                  {rule.description && <div className="text-[10px] text-muted-foreground mt-0.5">{rule.description}</div>}
                  <button
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => deleteRule(rule.id)}
                  >
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Built-in rules */}
        {BUILTIN_RULES.map((group) => (
          <div key={group.category}>
            <div className="flex items-center gap-2 mb-2">
              <group.icon className="w-3.5 h-3.5 text-accent" />
              <span className="text-xs font-semibold text-foreground">{group.category}</span>
            </div>
            <div className="space-y-1.5">
              {group.items.map((item, i) => (
                <div key={i} className="bg-muted rounded px-3 py-2">
                  <div className="text-[11px] font-mono text-destructive/80 line-through">{item.from}</div>
                  <div className="text-[11px] font-mono text-success">{item.to}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
