import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert Python engineer specializing in Python 3.13 compatibility.

Given an Airflow 3.x DAG file, you must:
1. Update all code to use Python 3.13 style and best practices
2. Replace deprecated Python patterns with modern equivalents
3. Use modern type hints (X | Y instead of Union[X, Y], list[str] instead of List[str])
4. Use match/case where appropriate instead of if/elif chains
5. Use modern string formatting (f-strings)
6. Update any deprecated stdlib usage
7. Ensure all imports use modern paths
8. Use modern exception handling patterns
9. Apply PEP 695 type parameter syntax where applicable
10. Use modern dataclass patterns

IMPORTANT: Do NOT change business logic — only modernize Python syntax and patterns.

Respond with valid JSON only. No markdown fences:
{
  "deployed_code": "the complete Python 3.13 compatible file",
  "changes": [
    {"line": "line number or range", "before": "old pattern", "after": "new pattern", "reason": "why"}
  ],
  "python_version_issues": ["list of Python version compatibility notes"],
  "summary": "2-3 sentence summary"
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
    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      return new Response(JSON.stringify({ error: "Missing code" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Update this Airflow 3.x DAG to be fully compatible with Python 3.13 style and best practices:\n\n${code}`;
    let content = await callAI(prompt);

    if (content.startsWith("```")) {
      content = content.split("\n").slice(1).join("\n").replace(/```\s*$/, "");
    }

    let parsed;
    try { parsed = JSON.parse(content); } catch {
      parsed = { deployed_code: code, changes: [], python_version_issues: [], summary: content };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("deploy-stage error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
