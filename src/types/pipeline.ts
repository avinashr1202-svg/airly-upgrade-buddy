export interface Change {
  line: string;
  before: string;
  after: string;
  reason: string;
}

export interface MigrationResult {
  fixed_code: string;
  changes: Change[];
  risk_level: string;
  summary: string;
  warnings: string[];
}

export interface DeployResult {
  deployed_code: string;
  changes: Change[];
  python_version_issues: string[];
  summary: string;
}

export interface TestResult {
  tests: TestCase[];
  overall_status: "pass" | "fail" | "warning";
  summary: string;
  confidence_score: number;
  remaining_issues: string[];
}

export interface TestCase {
  name: string;
  category: string;
  status: "pass" | "fail" | "warning";
  details: string;
  fix_suggestion: string | null;
}

export type PipelineStage =
  | "deployed"        // File uploaded to utility
  | "migration"       // Currently migrating
  | "migration_done"  // Migration complete
  | "testing"         // Currently testing
  | "completed";      // All done

export interface FileEntry {
  id: string;
  name: string;
  inputCode: string;
  stage: PipelineStage;
  progress: number;
  migrationResult: MigrationResult | null;
  deployResult: DeployResult | null;
  testResult: TestResult | null;
  error: string | null;
}

export interface CustomRule {
  id: string;
  category: string;
  from_pattern: string;
  to_pattern: string;
  description: string | null;
  created_at: string;
}
