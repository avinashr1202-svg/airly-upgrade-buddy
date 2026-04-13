import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { template_id, run_id, config } = await req.json();
    const targetDags = config.target_dags || [];

    // Simulate DAG monitoring execution
    const results: any[] = [];
    const logs: string[] = [];
    
    logs.push(`[${new Date().toISOString()}] Starting monitor DAG run...`);
    logs.push(`[${new Date().toISOString()}] Checking ${targetDags.length} target DAG(s)...`);

    // Simulate checking each target DAG
    for (const dagId of targetDags) {
      const rand = Math.random();
      const status = rand > 0.3 ? "success" : "failed";
      results.push({ dag_id: dagId, status });
      logs.push(`[${new Date().toISOString()}] ${dagId}: ${status === "success" ? "✅ SUCCESS" : "❌ FAILED"}`);
    }

    const failedDags = results.filter((r) => r.status === "failed");
    const overallStatus = failedDags.length === 0 ? "success" : "failed";

    let errorDetails: string | null = null;
    let fixSuggestion: string | null = null;

    if (failedDags.length > 0) {
      errorDetails = failedDags
        .map((f) => `DAG "${f.dag_id}" failed during execution.`)
        .join("\n");

      // Use AI to generate fix suggestions
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        try {
          const aiResponse = await fetch(
            "https://ai.gateway.lovable.dev/v1/chat/completions",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-3-flash-preview",
                messages: [
                  {
                    role: "system",
                    content: `You are an Apache Airflow expert. Given a list of failed DAGs, provide detailed step-by-step instructions on how to diagnose and fix the issues. Be specific and actionable. Format as numbered steps. Include common causes and solutions.`,
                  },
                  {
                    role: "user",
                    content: `The following Airflow DAGs have failed:\n${errorDetails}\n\nConfiguration: ${JSON.stringify(config)}\n\nProvide detailed steps to diagnose and fix these failures.`,
                  },
                ],
              }),
            }
          );

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            fixSuggestion =
              aiData.choices?.[0]?.message?.content || "Unable to generate fix suggestions.";
          }
        } catch (aiErr) {
          console.error("AI suggestion error:", aiErr);
          fixSuggestion = "Unable to generate AI fix suggestions. Please check the error details manually.";
        }
      }
    }

    logs.push(`[${new Date().toISOString()}] Monitor run completed: ${overallStatus.toUpperCase()}`);

    return new Response(
      JSON.stringify({
        status: overallStatus,
        logs: logs.join("\n"),
        error_details: errorDetails,
        fix_suggestion: fixSuggestion,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("run-monitor-dag error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
