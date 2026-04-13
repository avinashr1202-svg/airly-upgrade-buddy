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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const logs: string[] = [];
    logs.push(`[${new Date().toISOString()}] Starting error collection DAG run...`);
    logs.push(`[${new Date().toISOString()}] Scanning Airflow metadata for failed tasks...`);

    // Simulate collecting errors from Airflow
    const simulatedErrors = [
      { dag: "etl_pipeline", task: "extract_data", error: "ConnectionError: Unable to connect to source database", severity: "critical" },
      { dag: "etl_pipeline", task: "transform_data", error: "ValueError: Column 'user_id' contains null values", severity: "error" },
      { dag: "data_sync", task: "sync_users", error: "TimeoutError: API request timed out after 300s", severity: "error" },
      { dag: "report_gen", task: "generate_pdf", error: "MemoryError: Insufficient memory to process large dataset", severity: "critical" },
      { dag: "ml_training", task: "train_model", error: "FileNotFoundError: Training dataset not found at /data/train.csv", severity: "warning" },
    ];

    // Randomly pick 2-5 errors
    const count = Math.floor(Math.random() * 4) + 2;
    const selectedErrors = simulatedErrors.sort(() => Math.random() - 0.5).slice(0, count);

    logs.push(`[${new Date().toISOString()}] Found ${selectedErrors.length} error(s).`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    for (const err of selectedErrors) {
      let shortDescription = `${err.task} in ${err.dag} failed`;
      let fixSteps: string | null = null;

      // Use AI to generate short description and fix steps
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
                    content: `You are an Apache Airflow expert. Given an error from a DAG task, provide:
1. A one-line short description of the root cause
2. Numbered steps (3-5) to fix this error

Format your response as:
SHORT: <one line description>
STEPS:
1. ...
2. ...
3. ...`,
                  },
                  {
                    role: "user",
                    content: `DAG: ${err.dag}, Task: ${err.task}\nError: ${err.error}`,
                  },
                ],
              }),
            }
          );
          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const content = aiData.choices?.[0]?.message?.content || "";
            const shortMatch = content.match(/SHORT:\s*(.+)/);
            const stepsMatch = content.match(/STEPS:\s*([\s\S]+)/);
            if (shortMatch) shortDescription = shortMatch[1].trim();
            if (stepsMatch) fixSteps = stepsMatch[1].trim();
          }
        } catch (e) {
          console.error("AI error:", e);
        }
      }

      await supabase.from("dag_collected_errors").insert({
        template_id,
        run_id,
        dag_name: err.dag,
        task_id: err.task,
        error_message: err.error,
        short_description: shortDescription,
        fix_steps: fixSteps,
        severity: err.severity,
        execution_date: new Date().toISOString(),
      });

      logs.push(`[${new Date().toISOString()}] Collected: ${err.dag}.${err.task} - ${err.severity.toUpperCase()}`);
    }

    logs.push(`[${new Date().toISOString()}] Error collection completed. ${selectedErrors.length} error(s) stored.`);

    return new Response(
      JSON.stringify({
        status: "success",
        logs: logs.join("\n"),
        error_count: selectedErrors.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("run-error-dag error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
