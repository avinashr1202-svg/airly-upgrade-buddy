import { BookOpen, ArrowRightLeft, AlertCircle, Zap } from "lucide-react";

const RULES = [
  {
    category: "Import Paths",
    icon: ArrowRightLeft,
    items: [
      { from: "airflow.operators.python_operator", to: "airflow.operators.python" },
      { from: "airflow.operators.bash_operator", to: "airflow.operators.bash" },
      { from: "airflow.operators.dummy_operator", to: "airflow.operators.empty" },
      { from: "airflow.operators.dummy", to: "airflow.operators.empty" },
      { from: "airflow.sensors.external_task_sensor", to: "airflow.sensors.external_task" },
    ],
  },
  {
    category: "Deprecated Parameters",
    icon: AlertCircle,
    items: [
      { from: "schedule_interval='@daily'", to: "schedule='@daily'" },
      { from: "provide_context=True", to: "(removed — always provided)" },
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
      { from: "prev_execution_date", to: "data_interval_start" },
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

export function MigrationRules() {
  return (
    <div className="flex flex-col h-full overflow-auto scrollbar-thin">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-accent" />
          <span className="text-sm font-semibold text-foreground">Migration Rules Reference</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Key breaking changes from Airflow 2.x → 3.x
        </p>
      </div>

      <div className="p-4 space-y-5">
        {RULES.map((group) => (
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
