import { useState } from "react";
import { Upload, FileCode2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const SAMPLE_DAG = `from airflow import DAG
from airflow.operators.python_operator import PythonOperator
from airflow.utils.dates import days_ago
from datetime import timedelta

default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'email_on_failure': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

dag = DAG(
    'example_etl_pipeline',
    default_args=default_args,
    description='An example ETL pipeline',
    schedule_interval='@daily',
    start_date=days_ago(1),
    catchup=False,
    tags=['example'],
)

def extract(**kwargs):
    ti = kwargs['ti']
    execution_date = kwargs['execution_date']
    data = {"records": 100, "date": str(execution_date)}
    ti.xcom_push(key='extracted_data', value=data)

def transform(**kwargs):
    ti = kwargs['ti']
    data = ti.xcom_pull(key='extracted_data', task_ids='extract_task')
    data['records'] = data['records'] * 2
    ti.xcom_push(key='transformed_data', value=data)

def load(**kwargs):
    ti = kwargs['ti']
    data = ti.xcom_pull(key='transformed_data', task_ids='transform_task')
    print(f"Loading {data['records']} records")

extract_task = PythonOperator(
    task_id='extract_task',
    python_callable=extract,
    provide_context=True,
    dag=dag,
)

transform_task = PythonOperator(
    task_id='transform_task',
    python_callable=transform,
    provide_context=True,
    dag=dag,
)

load_task = PythonOperator(
    task_id='load_task',
    python_callable=load,
    provide_context=True,
    dag=dag,
)

extract_task >> transform_task >> load_task`;

interface CodeInputProps {
  code: string;
  setCode: (code: string) => void;
  isLoading: boolean;
  onUploadFiles?: (files: File[]) => void;
}

export function CodeInput({ code, setCode, isLoading, onUploadFiles }: CodeInputProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setCode(e.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter((f) => f.name.endsWith(".py"));
    if (droppedFiles.length > 1 && onUploadFiles) {
      onUploadFiles(droppedFiles);
    } else if (droppedFiles.length === 1) {
      handleFileUpload(droppedFiles[0]);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <FileCode2 className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Airflow 2.x DAG Input</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setCode(SAMPLE_DAG)}
            disabled={isLoading}
          >
            Load Sample
          </Button>
          <label>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              asChild
              disabled={isLoading}
            >
              <span>
                <Upload className="w-3 h-3 mr-1" />
                Upload .py
              </span>
            </Button>
            <input
              type="file"
              accept=".py"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />
          </label>
        </div>
      </div>

      <div
        className={`flex-1 relative ${dragOver ? "ring-2 ring-primary ring-inset" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Paste your Airflow 2.x DAG code here, or drag & drop a .py file..."
          className="w-full h-full code-editor p-4 resize-none border-0 outline-none scrollbar-thin text-foreground placeholder:text-muted-foreground"
          spellCheck={false}
          disabled={isLoading}
        />
        {dragOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/5 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2 text-primary">
              <Upload className="w-8 h-8" />
              <span className="text-sm font-medium">Drop .py file here</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
