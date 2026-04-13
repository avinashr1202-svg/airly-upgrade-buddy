import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert Airflow QA engineer and Python testing specialist.

Given an Airflow 3.x DAG file (already updated for Python 3.13), run a comprehensive simulated dry-run test suite:

1. **Import Validation**: Check all imports exist in Airflow 3.x and Python 3.13
2. **Deprecation Check**: Scan for ANY remaining Airflow 2.x deprecated patterns, parameters, or imports
3. **Python 3.13 Compatibility**: Verify all syntax is Python 3.13 compatible (no removed features)
4. **DAG Structure Validation**: Validate DAG definition, task dependencies, scheduling config
5. **Dry Run Simulation**: Simulate what would happen if the DAG were loaded — would it parse? Would tasks instantiate?
6. **Type Safety**: Check for type annotation issues
7. **Best Practices**: Check for common anti-patterns

For each test, provide: test name, status (pass/fail/warning), and details.

Respond with valid JSON only. No markdown fences:
{
  "tests": [
    {
      "name": "Test name",
      "category": "import_validation|deprecation_check|python_compatibility|dag_structure|dry_run|type_safety|best_practices",
      "status": "pass|fail|warning",
      "details": "What was checked and result",
      "fix_suggestion": "How to fix if failed (null if passed)"
    }
  ],
  "overall_status": "pass|fail|warning",
  "summary": "2-3 sentence overall assessment",
  "confidence_score": 85,
  "remaining_issues": ["list of any remaining concerns"]
}`;

async function callAI(userPrompt: string): Promise<string> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  const ANTHROPIC_ENDPOINT = Deno.env.get("ANTHROPIC_ENDPOINT") || "https://api.anthropic.com/v1/messages";

  if (ANTHROPIC_API_KEY) {
    const response = await fetch(ANTHROPIC_ENDPOINT, {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!response.ok) throw new Error("Claude API error");
    const data = await response.json();
    return data.content?.[0]?.text || "";
  }

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

  if (!response.ok) throw new Error("AI service error");
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, original_code } = await req.json();
    if (!code || typeof code !== "string") {
      return new Response(JSON.stringify({ error: "Missing code" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Run a comprehensive simulated dry-run test suite on this Airflow 3.x DAG (Python 3.13).\n\nMigrated Code:\n${code}\n\n${original_code ? `Original Airflow 2.x Code (for comparison):\n${original_code}` : ""}`;
    let content = await callAI(prompt);

    if (content.startsWith("```")) {
      content = content.split("\n").slice(1).join("\n").replace(/```\s*$/, "");
    }

    let parsed;
    try { parsed = JSON.parse(content); } catch {
      parsed = { tests: [], overall_status: "warning", summary: content, confidence_score: 0, remaining_issues: ["Could not parse test results"] };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("test-stage error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
