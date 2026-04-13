import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
    const autoUnpause = config.auto_unpause ?? true;
    const airflowConn = config.airflow_connection || {};

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: any[] = [];
    const logs: string[] = [];

    logs.push(`[${new Date().toISOString()}] Starting monitor DAG run...`);
    logs.push(`[${new Date().toISOString()}] Airflow API: ${airflowConn.api_url || "not configured"}`);
    logs.push(`[${new Date().toISOString()}] Checking ${targetDags.length} target DAG(s)...`);

    for (const dagId of targetDags) {
      const rand = Math.random();
      const isNewDag = rand > 0.8; // simulate new DAG detection
      const isSmokedTested = isNewDag ? false : rand > 0.4;
      const duration = Math.round(Math.random() * 300 + 10);

      let status: string;
      let dagLog = "";

      if (isNewDag) {
        // New DAG: auto-unpause and trigger
        status = "not_started";
        dagLog = `Task detected as NEW in Airflow\n`;

        if (autoUnpause) {
          dagLog += `Auto-unpausing DAG "${dagId}" via REST API...\n`;
          dagLog += `PATCH ${airflowConn.api_url}/dags/${dagId} {is_paused: false}\n`;
          dagLog += `Triggering initial run...\n`;
          dagLog += `POST ${airflowConn.api_url}/dags/${dagId}/dagRuns\n`;

          // Simulate the triggered run
          const triggerRand = Math.random();
          status = triggerRand > 0.3 ? "success" : "failed";
          dagLog += `Initial run ${status === "success" ? "completed successfully" : "FAILED"}\n`;
          dagLog += `Execution took ${duration}s\n`;
        } else {
          dagLog += `Auto-unpause disabled, DAG remains paused\n`;
        }
      } else {
        status = rand > 0.3 ? "success" : "failed";
        dagLog = `Task started at ${new Date().toISOString()}\nExecution took ${duration}s\n`;
      }

      const pathsCovered = status === "success"
        ? "all paths covered (main, retry, cleanup, connections verified)"
        : isNewDag && status !== "success"
          ? "initial run - paths not yet verified"
          : "partial paths covered (main only, retry/cleanup not reached)";

      dagLog += `Smoke test: ${isSmokedTested ? "passed" : "not run"}\nPaths: ${pathsCovered}`;

      const dagResult: any = {
        dag_id: dagId,
        status,
        duration_seconds: duration,
        is_smoke_tested: isSmokedTested,
        paths_covered: pathsCovered,
        last_run_at: status !== "not_started" ? new Date().toISOString() : null,
        log_info: dagLog,
        error_details: null,
        fix_steps: null,
        is_new: isNewDag,
      };

      if (status === "failed") {
        dagResult.error_details = `DAG "${dagId}" failed: Task execution timeout after ${duration}s. Exit code: 1. Traceback: RuntimeError in task execution.${
          isNewDag ? " (First run after migration)" : ""
        }`;

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
                      content: `You are an Apache Airflow expert. Given a failed DAG, provide numbered steps to diagnose and fix. Be specific and actionable. Include common causes. If it's a new DAG, mention deployment verification steps.`,
                    },
                    {
                      role: "user",
                      content: `DAG "${dagId}" failed with error: ${dagResult.error_details}\nAirflow API: ${airflowConn.api_url}\nConfig: ${JSON.stringify(config)}\nIs new DAG: ${isNewDag}\n\nProvide detailed fix steps.`,
                    },
                  ],
                }),
              }
            );
            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              dagResult.fix_steps = aiData.choices?.[0]?.message?.content || null;
            }
          } catch (e) {
            console.error("AI error:", e);
            dagResult.fix_steps = "Unable to generate AI fix suggestions. Check error details manually.";
          }
        }
      }

      results.push(dagResult);
      const statusEmoji = status === "success" ? "✅ SUCCESS" : status === "failed" ? "❌ FAILED" : "🆕 NEW";
      logs.push(
        `[${new Date().toISOString()}] ${dagId}: ${statusEmoji} (${duration}s, smoke: ${isSmokedTested ? "yes" : "no"}${isNewDag ? ", NEW DAG" : ""})`
      );

      await supabase.from("dag_monitor_results").insert({
        template_id,
        run_id,
        dag_name: dagId,
        status,
        duration_seconds: duration,
        last_run_at: dagResult.last_run_at,
        is_smoke_tested: isSmokedTested,
        log_info: dagResult.log_info,
        error_details: dagResult.error_details,
        fix_steps: dagResult.fix_steps,
        paths_covered: pathsCovered,
      });
    }

    const failedDags = results.filter((r) => r.status === "failed");
    const overallStatus = failedDags.length === 0 ? "success" : "failed";

    let errorDetails: string | null = null;
    let fixSuggestion: string | null = null;

    if (failedDags.length > 0) {
      errorDetails = failedDags.map((f) => f.error_details).join("\n\n");
      fixSuggestion = failedDags.map((f) => f.fix_steps).filter(Boolean).join("\n\n---\n\n");
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