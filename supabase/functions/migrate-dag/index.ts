import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert Apache Airflow migration engineer. Your job is to migrate DAGs from Airflow 2.x to Airflow 3.x while ensuring Python 3.13 compatibility.

## CRITICAL RULES
1. **DO NOT change any business logic, task definitions, or workflow behavior.**
2. **Only change what is necessary** for Airflow 3.x compatibility and Python 3.13 style.
3. **Preserve all comments, docstrings, and variable names** unless they reference deprecated APIs.
4. The output must be a complete, runnable Python 3.13 script.

## STANDARD AIRFLOW 3.x IMPORTS
Every migrated DAG MUST include the appropriate standard imports from this list (only include what the DAG actually uses):

\`\`\`python
from __future__ import annotations

import pendulum
from datetime import datetime, timedelta

from airflow.sdk import DAG, dag  # DAG class or @dag decorator
from airflow.providers.standard.operators.python import PythonOperator
from airflow.providers.standard.operators.bash import BashOperator
from airflow.providers.standard.operators.empty import EmptyOperator  # replaces DummyOperator
from airflow.providers.standard.sensors.time import TimeSensor, TimeSensorAsync
from airflow.providers.standard.sensors.filesystem import FileSensor
from airflow.sdk.bases.decorator import task  # @task decorator (TaskFlow API)
from airflow.models.baseoperator import chain, cross_downstream
from airflow.utils.task_group import TaskGroup  # replaces SubDagOperator
from airflow.models.param import Param
\`\`\`

## MIGRATION RULES TO APPLY
- \`from airflow import DAG\` → \`from airflow.sdk import DAG\`
- \`from airflow.operators.python_operator import PythonOperator\` → \`from airflow.providers.standard.operators.python import PythonOperator\`
- \`from airflow.operators.python import PythonOperator\` → \`from airflow.providers.standard.operators.python import PythonOperator\`
- \`from airflow.operators.bash_operator import BashOperator\` → \`from airflow.providers.standard.operators.bash import BashOperator\`
- \`from airflow.operators.bash import BashOperator\` → \`from airflow.providers.standard.operators.bash import BashOperator\`
- \`from airflow.operators.dummy_operator import DummyOperator\` → \`from airflow.providers.standard.operators.empty import EmptyOperator\`
- \`from airflow.operators.dummy import DummyOperator\` → \`from airflow.providers.standard.operators.empty import EmptyOperator\`
- \`DummyOperator\` → \`EmptyOperator\`
- \`from airflow.sensors.filesystem import FileSensor\` → \`from airflow.providers.standard.sensors.filesystem import FileSensor\`
- \`from airflow.decorators import task\` → \`from airflow.sdk.bases.decorator import task\`
- \`schedule_interval=\` → \`schedule=\` in DAG()
- Remove \`provide_context=True\` from PythonOperator (always provided in 3.x)
- \`execution_date\` → \`logical_date\` or \`data_interval_start\`/\`data_interval_end\`
- \`days_ago(N)\` → \`pendulum.today("UTC").subtract(days=N)\`
- \`task_concurrency=\` → \`max_active_tis_per_dag=\`
- Replace \`SubDagOperator\` with \`TaskGroup\`
- Add \`from __future__ import annotations\` at the top if not present

## PYTHON 3.13 STYLE REQUIREMENTS
- Use \`X | Y\` instead of \`Union[X, Y]\` and \`Optional[X]\` → \`X | None\`
- Use \`list[str]\` instead of \`List[str]\`, \`dict[str, int]\` instead of \`Dict[str, int]\`
- Use f-strings instead of .format() or % formatting
- Use modern exception handling (\`except Exception as e:\`)
- Use \`from __future__ import annotations\` for forward references

## OUTPUT FORMAT
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

async function callLovableAI(userPrompt: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("AI service not configured");

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
    if (response.status === 429) throw new Error("Rate limit exceeded. Please try again in a moment.");
    if (response.status === 402) throw new Error("AI credits exhausted. Please add funds in Settings → Workspace → Usage.");
    throw new Error("AI service error");
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callAnthropicAPI(userPrompt: string, apiKey: string, endpoint: string): Promise<string> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const t = await response.text();
    console.error("Anthropic API error:", response.status, t);
    if (response.status === 429) throw new Error("Rate limit exceeded. Please try again in a moment.");
    throw new Error("Claude API error");
  }

  const data = await response.json();
  return data.content?.[0]?.text || "";
}

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

    const userPrompt = mode === "analyze"
      ? `Analyze this Airflow 2.x DAG and list all migration issues WITHOUT providing fixed code. Set fixed_code to empty string.\n\n${code}`
      : `Migrate this Airflow 2.x DAG to Airflow 3.x:\n\n${code}`;

    // Use Anthropic Claude if API key is configured, otherwise fall back to Lovable AI
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const ANTHROPIC_ENDPOINT = Deno.env.get("ANTHROPIC_ENDPOINT") || "https://api.anthropic.com/v1/messages";

    let content: string;
    if (ANTHROPIC_API_KEY) {
      console.log("Using Anthropic Claude API");
      content = await callAnthropicAPI(userPrompt, ANTHROPIC_API_KEY, ANTHROPIC_ENDPOINT);
    } else {
      console.log("Using Lovable AI Gateway (default)");
      content = await callLovableAI(userPrompt);
    }

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
