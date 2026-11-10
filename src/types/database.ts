/**
 * Tipos do banco Supabase.
 *
 * Este arquivo é provisório. Gere a versão definitiva após conectar o projeto:
 *
 *   supabase gen types typescript --linked > src/types/database.ts
 *
 * enquanto isso, mantemos uma estrutura mínima `public` para tipar o Client.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AreaType = "CONCURSO" | "VESTIBULAR";
export type EditalStatus = "DRAFT" | "ACTIVE";
export type Importance = "CAI_POUCO" | "CAI_MEDIO" | "CAI_MUITO";
export type ProgressStatus = "NOT_STARTED" | "IN_PROGRESS" | "REVISED" | "DONE";
export type ActivityType = "THEORY" | "QUESTIONS" | "REVIEW" | "SIMULATED";
export type QuestionLevel = "EASY" | "MEDIUM" | "HARD";
export type QuestionResult = "CORRECT" | "WRONG" | "SKIPPED";
export type EntityType = "CYCLE" | "EDITAL";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          avatar_url: string | null;
          weekly_goal_min: number;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name?: string;
          avatar_url?: string | null;
          weekly_goal_min?: number;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          avatar_url?: string | null;
          weekly_goal_min?: number;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      study_areas: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          target_type: AreaType;
          exam_board: string | null;
          exam_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          target_type?: AreaType;
          exam_board?: string | null;
          exam_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          target_type?: AreaType;
          exam_board?: string | null;
          exam_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      editals: {
        Row: {
          id: string;
          study_area_id: string;
          user_id: string;
          title: string;
          source_pdf_path: string | null;
          raw_text: string | null;
          status: EditalStatus;
          is_public: boolean;
          extraction_status: string;
          extraction_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          study_area_id: string;
          user_id: string;
          title: string;
          source_pdf_path?: string | null;
          raw_text?: string | null;
          status?: EditalStatus;
          is_public?: boolean;
          extraction_status?: string;
          extraction_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          study_area_id?: string;
          user_id?: string;
          title?: string;
          source_pdf_path?: string | null;
          raw_text?: string | null;
          status?: EditalStatus;
          is_public?: boolean;
          extraction_status?: string;
          extraction_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      edital_subjects: {
        Row: {
          id: string;
          edital_id: string;
          parent_id: string | null;
          name: string;
          weight: number | null;
          importance: Importance;
          sort_order: number;
          progress_studied: number;
          status: ProgressStatus;
        };
        Insert: {
          id?: string;
          edital_id: string;
          parent_id?: string | null;
          name: string;
          weight?: number | null;
          importance?: Importance;
          sort_order?: number;
          progress_studied?: number;
          status?: ProgressStatus;
        };
        Update: {
          id?: string;
          edital_id?: string;
          parent_id?: string | null;
          name?: string;
          weight?: number | null;
          importance?: Importance;
          sort_order?: number;
          progress_studied?: number;
          status?: ProgressStatus;
        };
        Relationships: [];
      };
      cycles: {
        Row: {
          id: string;
          study_area_id: string;
          user_id: string;
          name: string;
          description: string | null;
          period_days: number;
          is_public: boolean;
          source_cycle_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          study_area_id: string;
          user_id: string;
          name: string;
          description?: string | null;
          period_days?: number;
          is_public?: boolean;
          source_cycle_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          study_area_id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          period_days?: number;
          is_public?: boolean;
          source_cycle_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cycle_blocks: {
        Row: {
          id: string;
          cycle_id: string;
          subject_id: string | null;
          subject_name: string;
          topic_id: string | null;
          topic_name: string | null;
          activity: ActivityType;
          minutes: number;
          day_of_cycle: number;
          sort_order: number;
        };
        Insert: {
          id?: string;
          cycle_id: string;
          subject_id?: string | null;
          subject_name: string;
          topic_id?: string | null;
          topic_name?: string | null;
          activity?: ActivityType;
          minutes?: number;
          day_of_cycle?: number;
          sort_order?: number;
        };
        Update: {
          id?: string;
          cycle_id?: string;
          subject_id?: string | null;
          subject_name?: string;
          topic_id?: string | null;
          topic_name?: string | null;
          activity?: ActivityType;
          minutes?: number;
          day_of_cycle?: number;
          sort_order?: number;
        };
        Relationships: [];
      };
      study_sessions: {
        Row: {
          id: string;
          user_id: string;
          study_area_id: string | null;
          subject_id: string | null;
          subject_name: string;
          topic_id: string | null;
          topic_name: string | null;
          activity: ActivityType;
          started_at: string;
          ended_at: string | null;
          duration_sec: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          study_area_id?: string | null;
          subject_id?: string | null;
          subject_name: string;
          topic_id?: string | null;
          topic_name?: string | null;
          activity?: ActivityType;
          started_at?: string;
          ended_at?: string | null;
          duration_sec?: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          study_area_id?: string | null;
          subject_id?: string | null;
          subject_name?: string;
          topic_id?: string | null;
          topic_name?: string | null;
          activity?: ActivityType;
          started_at?: string;
          ended_at?: string | null;
          duration_sec?: number;
        };
        Relationships: [];
      };
      questions: {
        Row: {
          id: string;
          user_id: string;
          study_area_id: string | null;
          subject_id: string | null;
          subject_name: string;
          topic_id: string | null;
          topic_name: string | null;
          exam_board: string | null;
          level: QuestionLevel;
          result: QuestionResult;
          took_sec: number | null;
          answered_at: string;
          notes: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          study_area_id?: string | null;
          subject_id?: string | null;
          subject_name: string;
          topic_id?: string | null;
          topic_name?: string | null;
          exam_board?: string | null;
          level?: QuestionLevel;
          result?: QuestionResult;
          took_sec?: number | null;
          answered_at?: string;
          notes?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          study_area_id?: string | null;
          subject_id?: string | null;
          subject_name?: string;
          topic_id?: string | null;
          topic_name?: string | null;
          exam_board?: string | null;
          level?: QuestionLevel;
          result?: QuestionResult;
          took_sec?: number | null;
          answered_at?: string;
          notes?: string | null;
        };
        Relationships: [];
      };
      edital_extraction_cache: {
        Row: {
          content_hash: string;
          payload: Json;
          provider: string;
          model: string | null;
          hit_count: number;
          created_at: string;
        };
        Insert: {
          content_hash: string;
          payload: Json;
          provider?: string;
          model?: string | null;
          hit_count?: number;
          created_at?: string;
        };
        Update: {
          content_hash?: string;
          payload?: Json;
          provider?: string;
          model?: string | null;
          hit_count?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      shared_links: {
        Row: {
          id: string;
          entity_type: EntityType;
          entity_id: string;
          owner_id: string;
          slug: string;
          created_at: string;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          entity_type: EntityType;
          entity_id: string;
          owner_id: string;
          slug: string;
          created_at?: string;
          expires_at?: string | null;
        };
        Update: {
          id?: string;
          entity_type?: EntityType;
          entity_id?: string;
          owner_id?: string;
          slug?: string;
          created_at?: string;
          expires_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      analytics_hours_by_subject: {
        Args: { _from: string; _to: string };
        Returns: { subject_name: string; minutes: number; sessions: number }[];
      };
      analytics_hours_by_day: {
        Args: { _from: string; _to: string };
        Returns: { day: string; minutes: number; sessions: number }[];
      };
      analytics_hours_by_subject_day: {
        Args: { _from: string; _to: string };
        Returns: { day: string; subject_name: string; minutes: number }[];
      };
      analytics_accuracy_by_subject: {
        Args: { _from: string; _to: string };
        Returns: {
          subject_name: string;
          total: number;
          correct: number;
          wrong: number;
          accuracy: number;
        }[];
      };
      bump_extraction_cache_hit: {
        Args: { _hash: string };
        Returns: undefined;
      };
      consume_extraction_quota: {
        Args: Record<string, never>;
        Returns: { allowed: boolean; remaining: number }[];
      };
      sync_topic_progress: {
        Args: { _topic_id: string };
        Returns: undefined;
      };
      analytics_hours_by_topic: {
        Args: { _from: string; _to: string };
        Returns: {
          topic_id: string;
          topic_name: string;
          subject_name: string;
          minutes: number;
          sessions: number;
        }[];
      };
      analytics_accuracy_by_topic: {
        Args: { _from: string; _to: string };
        Returns: {
          topic_id: string;
          topic_name: string;
          subject_name: string;
          total: number;
          correct: number;
          accuracy: number;
        }[];
      };
      analytics_edital_coverage: {
        Args: Record<string, never>;
        Returns: {
          subject_id: string;
          subject_name: string;
          total_topics: number;
          started_topics: number;
          done_topics: number;
          coverage_pct: number;
        }[];
      };
      analytics_totals: {
        Args: { _from: string; _to: string };
        Returns: {
          total_minutes: number;
          total_sessions: number;
          questions_total: number;
          questions_correct: number;
          accuracy: number;
          active_days: number;
        }[];
      };
    };
    Enums: {
      area_type: AreaType;
      edital_status: EditalStatus;
      importance: Importance;
      progress_status: ProgressStatus;
      activity_type: ActivityType;
      level: QuestionLevel;
      result: QuestionResult;
      entity_type: EntityType;
    };
    CompositeTypes: Record<string, never>;
  };
}
