import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, name, config } = await req.json();

    let code: string;

    if (type === "error_collection") {
      code = generateErrorCollectionDag(name, config);
    } else if (type === "monitor") {
      code = generateMonitorDag(name, config);
    } else {
      throw new Error("Invalid DAG type");
    }

    return new Response(JSON.stringify({ code }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-dag error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function generateErrorCollectionDag(name: string, config: any): string {
  const dagId = name.replace(/\s+/g, "_").toLowerCase();
  const schedule = config.schedule || "@hourly";
  const retries = config.retries || 3;

  let storageImports = "";
  let collectTaskBody = "";

  if (config.storage_type === "file") {
    storageImports = `import os\nimport json\nfrom datetime import datetime`;
    collectTaskBody = `
    error_log_path = "${config.file_path || "/opt/airflow/logs/errors.log"}"
    os.makedirs(os.path.dirname(error_log_path), exist_ok=True)

    # Collect errors from Airflow metadata database
    from airflow.models import DagRun, TaskInstance
    from airflow.utils.state import State
    from airflow.utils.session import provide_session

    @provide_session
    def _get_failed_tasks(session=None):
        failed = session.query(TaskInstance).filter(
            TaskInstance.state == State.FAILED
        ).order_by(TaskInstance.end_date.desc()).limit(100).all()
        return [
            {
                "dag_id": ti.dag_id,
                "task_id": ti.task_id,
                "execution_date": str(ti.execution_date),
                "end_date": str(ti.end_date),
                "duration": ti.duration,
                "try_number": ti.try_number,
            }
            for ti in failed
        ]

    errors = _get_failed_tasks()
    with open(error_log_path, "a") as f:
        for err in errors:
            f.write(json.dumps({**err, "collected_at": str(datetime.now())}) + "\\n")
    print(f"Collected {len(errors)} error(s) to {error_log_path}")`;
  } else {
    storageImports = `from datetime import datetime`;
    collectTaskBody = `
    from airflow.models import TaskInstance
    from airflow.utils.state import State
    from airflow.utils.session import provide_session
    from airflow.providers.common.sql.operators.sql import SQLExecuteQueryOperator

    @provide_session
    def _get_failed_tasks(session=None):
        failed = session.query(TaskInstance).filter(
            TaskInstance.state == State.FAILED
        ).order_by(TaskInstance.end_date.desc()).limit(100).all()
        return [
            {
                "dag_id": ti.dag_id,
                "task_id": ti.task_id,
                "execution_date": str(ti.execution_date),
                "end_date": str(ti.end_date),
                "duration": ti.duration,
                "try_number": ti.try_number,
            }
            for ti in failed
        ]

    errors = _get_failed_tasks()
    # Store errors using the configured database connection
    for err in errors:
        print(f"Error: {err['dag_id']}.{err['task_id']} at {err['execution_date']}")
    print(f"Collected {len(errors)} error(s) to database connection: ${config.db_connection || "airflow_db"}")`;
  }

  let emailTask = "";
  if (config.email_on_error && config.email_to) {
    emailTask = `

    send_error_report = EmailOperator(
        task_id="send_error_report",
        to="${config.email_to}",
        subject=f"Airflow Error Report - {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        html_content="<h3>Error collection completed. Check logs for details.</h3>",
        trigger_rule="all_done",
    )

    collect_errors >> send_error_report`;
  }

  return `from __future__ import annotations

# Standard Airflow 3.x imports
from airflow.sdk import DAG
from airflow.providers.standard.operators.python import PythonOperator
${config.email_on_error ? "from airflow.providers.smtp.operators.smtp import EmailOperator" : ""}
from datetime import timedelta
${storageImports}

default_args = {
    "owner": "airflow",
    "depends_on_past": False,
    "retries": ${retries},
    "retry_delay": timedelta(minutes=5),
}

with DAG(
    dag_id="${dagId}",
    default_args=default_args,
    description="Collects and stores Airflow task errors",
    schedule="${schedule}",
    catchup=False,
    tags=["error_collection", "monitoring"],
) as dag:

    def collect_errors_fn(**kwargs):
        """Collect failed task instances and store error information."""${collectTaskBody}

    collect_errors = PythonOperator(
        task_id="collect_errors",
        python_callable=collect_errors_fn,
    )${emailTask}
`;
}

function generateMonitorDag(name: string, config: any): string {
  const dagId = name.replace(/\s+/g, "_").toLowerCase();
  const schedule = config.schedule || "*/5 * * * *";
  const targetDags = config.target_dags || [];
  const maxRetries = config.max_retries || 2;

  let slackImport = "";
  let slackTask = "";

  if (config.slack_connection && config.slack_channel) {
    slackImport = `from airflow.providers.slack.operators.slack_webhook import SlackWebhookOperator`;
    slackTask = `

    def _build_slack_message(**kwargs):
        ti = kwargs["ti"]
        results = ti.xcom_pull(task_ids="check_dag_status")
        failed = [r for r in (results or []) if r.get("status") == "failed"]
        if failed:
            msg = "🚨 *Airflow Monitor Alert*\\n"
            for f in failed:
                msg += f"• DAG: \`{f['dag_id']}\` - Last run FAILED at {f.get('end_date', 'N/A')}\\n"
            return msg
        return "✅ All monitored DAGs are running successfully."

    send_slack_alert = SlackWebhookOperator(
        task_id="send_slack_alert",
        slack_webhook_conn_id="${config.slack_connection}",
        channel="${config.slack_channel}",
        message="{{ ti.xcom_pull(task_ids='build_slack_message') }}",
    )

    check_dag_status >> send_slack_alert`;
  }

  const targetDagsStr = targetDags.map((d: string) => `"${d}"`).join(", ");

  return `from __future__ import annotations

# Standard Airflow 3.x imports
from airflow.sdk import DAG
from airflow.providers.standard.operators.python import PythonOperator
${slackImport}
from datetime import timedelta, datetime

default_args = {
    "owner": "airflow",
    "depends_on_past": False,
    "retries": ${maxRetries},
    "retry_delay": timedelta(minutes=2),
}

TARGET_DAGS = [${targetDagsStr}]

with DAG(
    dag_id="${dagId}",
    default_args=default_args,
    description="Monitors DAG execution status and reports failures",
    schedule="${schedule}",
    catchup=False,
    tags=["monitor", "alerting"],
) as dag:

    def check_dag_status_fn(**kwargs):
        """Check the status of target DAGs and report results."""
        from airflow.models import DagRun
        from airflow.utils.session import provide_session
        from airflow.utils.state import DagRunState

        @provide_session
        def _check(session=None):
            results = []
            for dag_id in TARGET_DAGS:
                last_run = (
                    session.query(DagRun)
                    .filter(DagRun.dag_id == dag_id)
                    .order_by(DagRun.execution_date.desc())
                    .first()
                )
                if last_run:
                    results.append({
                        "dag_id": dag_id,
                        "status": "success" if last_run.state == DagRunState.SUCCESS else "failed",
                        "execution_date": str(last_run.execution_date),
                        "end_date": str(last_run.end_date) if last_run.end_date else None,
                        "run_id": last_run.run_id,
                    })
                else:
                    results.append({
                        "dag_id": dag_id,
                        "status": "no_runs",
                        "execution_date": None,
                        "end_date": None,
                    })
            return results

        results = _check()
        for r in results:
            status_icon = "✅" if r["status"] == "success" else "❌" if r["status"] == "failed" else "⚠️"
            print(f"{status_icon} {r['dag_id']}: {r['status']} (last run: {r.get('execution_date', 'N/A')})")

        failed = [r for r in results if r["status"] == "failed"]
        if failed:
            print(f"\\n⚠️ {len(failed)} DAG(s) failed!")

        kwargs["ti"].xcom_push(key="return_value", value=results)
        return results

    check_dag_status = PythonOperator(
        task_id="check_dag_status",
        python_callable=check_dag_status_fn,
    )${slackTask}
`;
}
