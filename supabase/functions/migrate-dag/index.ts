import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert Apache Airflow migration engineer. Your job is to migrate DAGs from Airflow 2.x to Airflow 3.x while ensuring Python 3.13 compatibility.

## ABSOLUTE RULES — READ CAREFULLY
1. **DO NOT remove, delete, or skip ANY existing code.** Every single line of the original script must appear in the output.
2. **DO NOT change the coding style, formatting, indentation style, or structure** of the original code. If the original uses 4-space indents, keep 4-space. If it has blank lines between functions, keep them.
3. **DO NOT rewrite or refactor any business logic, function bodies, task definitions, SQL queries, variable assignments, or workflow behavior.**
4. **ONLY change what is strictly required** for Airflow 3.x compatibility: import paths, deprecated parameter names, and deprecated API references.
5. The output must be the COMPLETE original file with ONLY the necessary migration changes applied.

## IMPORT STRUCTURE (TOP OF FILE)
The migrated file MUST have this import structure at the top:

### Section 1: Future imports (always first)
\`\`\`python
from __future__ import annotations
\`\`\`

### Section 2: Standard Airflow 3.x libraries (add ALL of these)
These standard Airflow 3.x imports MUST always be present at the top, even if not all are used by the DAG. This ensures every migrated DAG has the full standard library available:
\`\`\`python
# Standard Airflow 3.x imports
import pendulum
from datetime import datetime, timedelta

from airflow.sdk import DAG
from airflow.providers.standard.operators.python import PythonOperator
from airflow.providers.standard.operators.bash import BashOperator
from airflow.providers.standard.operators.empty import EmptyOperator
from airflow.providers.standard.sensors.time import TimeSensor, TimeSensorAsync
from airflow.providers.standard.sensors.filesystem import FileSensor
from airflow.sdk.bases.decorator import task, dag
from airflow.models.baseoperator import chain, cross_downstream
from airflow.utils.task_group import TaskGroup
from airflow.models.param import Param
\`\`\`

### Section 3: Other imports from the original file
Place all other non-Airflow imports (os, sys, logging, custom modules, provider-specific operators like GCP/AWS/Slack etc.) BELOW the standard block, in the same order they appeared in the original file. Do NOT remove any of these.

## MIGRATION CHANGES (ONLY these replacements in the code body)
- \`schedule_interval=\` → \`schedule=\` in DAG() constructor only
- Remove \`provide_context=True\` parameter from PythonOperator calls only
- \`execution_date\` → \`logical_date\` in template references and kwargs only
- \`days_ago(N)\` → \`pendulum.today("UTC").subtract(days=N)\`
- \`task_concurrency=\` → \`max_active_tis_per_dag=\`
- \`DummyOperator(\` → \`EmptyOperator(\` (class name replacement only)
- Replace \`SubDagOperator\` usage with \`TaskGroup\` equivalent

## WHAT TO LEAVE UNCHANGED
- All function definitions and their bodies
- All variable assignments and values
- All SQL queries, strings, and data
- All task parameters (except deprecated ones listed above)
- All DAG parameters (except schedule_interval)
- All comments and docstrings
- All blank lines and formatting
- All custom operator/hook/sensor imports (just keep them as-is unless path changed)
- The overall file structure and ordering of code blocks

## PYTHON 3.13 MINIMAL CHANGES
Only apply these if they exist in the original:
- \`Union[X, Y]\` → \`X | Y\`
- \`Optional[X]\` → \`X | None\`
- \`List[str]\` → \`list[str]\`, \`Dict[str, int]\` → \`dict[str, int]\`
Do NOT rewrite string formatting, do NOT add type hints that didn't exist, do NOT restructure code.

## OUTPUT FORMAT
Respond with valid JSON only. No markdown fences, no preamble:
{
  "fixed_code": "the COMPLETE file — every line from original must be present with only necessary changes",
  "changes": [
    {"line": "line number", "before": "exact old text", "after": "exact new text", "reason": "migration rule applied"}
  ],
  "risk_level": "low|medium|high",
  "summary": "2-3 sentence summary",
  "warnings": ["any warnings"]
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
