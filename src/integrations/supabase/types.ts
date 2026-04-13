export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      custom_rules: {
        Row: {
          category: string
          created_at: string
          description: string | null
          from_pattern: string
          id: string
          to_pattern: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          from_pattern: string
          id?: string
          to_pattern: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          from_pattern?: string
          id?: string
          to_pattern?: string
        }
        Relationships: []
      }
      dag_collected_errors: {
        Row: {
          collected_at: string
          dag_name: string
          error_message: string
          execution_date: string | null
          fix_steps: string | null
          id: string
          run_id: string | null
          severity: string
          short_description: string | null
          task_id: string | null
          template_id: string
        }
        Insert: {
          collected_at?: string
          dag_name: string
          error_message: string
          execution_date?: string | null
          fix_steps?: string | null
          id?: string
          run_id?: string | null
          severity?: string
          short_description?: string | null
          task_id?: string | null
          template_id: string
        }
        Update: {
          collected_at?: string
          dag_name?: string
          error_message?: string
          execution_date?: string | null
          fix_steps?: string | null
          id?: string
          run_id?: string | null
          severity?: string
          short_description?: string | null
          task_id?: string | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dag_collected_errors_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "dag_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dag_collected_errors_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "dag_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      dag_monitor_results: {
        Row: {
          collected_at: string
          dag_name: string
          duration_seconds: number | null
          error_details: string | null
          fix_steps: string | null
          id: string
          is_smoke_tested: boolean
          last_run_at: string | null
          log_info: string | null
          paths_covered: string | null
          run_id: string | null
          status: string
          template_id: string
        }
        Insert: {
          collected_at?: string
          dag_name: string
          duration_seconds?: number | null
          error_details?: string | null
          fix_steps?: string | null
          id?: string
          is_smoke_tested?: boolean
          last_run_at?: string | null
          log_info?: string | null
          paths_covered?: string | null
          run_id?: string | null
          status?: string
          template_id: string
        }
        Update: {
          collected_at?: string
          dag_name?: string
          duration_seconds?: number | null
          error_details?: string | null
          fix_steps?: string | null
          id?: string
          is_smoke_tested?: boolean
          last_run_at?: string | null
          log_info?: string | null
          paths_covered?: string | null
          run_id?: string | null
          status?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dag_monitor_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "dag_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dag_monitor_results_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "dag_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      dag_runs: {
        Row: {
          completed_at: string | null
          error_details: string | null
          fix_suggestion: string | null
          id: string
          logs: string | null
          started_at: string
          status: Database["public"]["Enums"]["dag_run_status"]
          template_id: string
        }
        Insert: {
          completed_at?: string | null
          error_details?: string | null
          fix_suggestion?: string | null
          id?: string
          logs?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["dag_run_status"]
          template_id: string
        }
        Update: {
          completed_at?: string | null
          error_details?: string | null
          fix_suggestion?: string | null
          id?: string
          logs?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["dag_run_status"]
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dag_runs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "dag_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      dag_templates: {
        Row: {
          config: Json
          created_at: string
          generated_code: string | null
          id: string
          name: string
          type: Database["public"]["Enums"]["dag_type"]
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          generated_code?: string | null
          id?: string
          name: string
          type: Database["public"]["Enums"]["dag_type"]
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          generated_code?: string | null
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["dag_type"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      dag_run_status: "running" | "success" | "failed"
      dag_type: "error_collection" | "monitor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      dag_run_status: ["running", "success", "failed"],
      dag_type: ["error_collection", "monitor"],
    },
  },
} as const
