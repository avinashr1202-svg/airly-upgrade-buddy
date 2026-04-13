import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert Apache Airflow migration engineer specializing in migrating DAGs from Airflow 2.x to 3.x.

When given Airflow 2.x DAG code, you must:
1. Analyze it for all Airflow 2.x patterns that need migration
2. Rewrite it to be fully compatible with Airflow 3.x
3. Provide a detailed list of all changes made

Key migration rules you MUST apply:
- Update deprecated import paths (e.g., airflow.operators.python_operator → airflow.operators.python)
- Replace schedule_interval with schedule parameter in DAG definition
- Remove provide_context=True from PythonOperator (context is always provided in 3.x)
- Replace execution_date references with logical_date or data_interval_start/data_interval_end
- Replace days_ago() with pendulum.today().subtract(days=N) or datetime equivalents
- Update Variable.get/set usage patterns
- Replace XComArg patterns with TaskFlow API where appropriate
- Update deprecated sensor parameters (e.g., poke_interval changes)
- Replace BashOperator imports if path changed
- Update connection type references
- Replace deprecated DAG context manager patterns
- Update task_concurrency to max_active_tis_per_dag
- Replace trigger_rule imports if needed
- Update any deprecated hooks or operators to their new paths
- Remove any usage of SubDagOperator (replaced by TaskGroup)

IMPORTANT: Do NOT change business logic — only fix compatibility issues.

Respond with valid JSON only. No markdown fences, no preamble:
{
  "fixed_code": "the complete rewritten Python file",
  "changes": [
    {"line": "approximate line number or range", "before": "old pattern", "after": "new pattern", "reason": "why this change was needed"}
  ],
  "risk_level": "low|medium|high",
  "summary": "2-3 sentence summary of migration complexity",
  "warnings": ["any warnings about things that need manual review"]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, mode } = await req.json();

    if (!code || typeof code !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'code' field" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userPrompt = mode === "analyze"
      ? `Analyze this Airflow 2.x DAG and list all migration issues WITHOUT providing fixed code. Set fixed_code to empty string.\n\n${code}`
      : `Migrate this Airflow 2.x DAG to Airflow 3.x:\n\n${code}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";

    // Strip markdown fences if present
    if (content.startsWith("```")) {
      content = content.split("\n").slice(1).join("\n");
      content = content.replace(/```\s*$/, "");
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {
        fixed_code: "",
        changes: [],
        risk_level: "medium",
        summary: content,
        warnings: ["AI response could not be parsed as structured JSON"],
      };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("migrate-dag error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
