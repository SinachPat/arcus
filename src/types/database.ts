// Auto-generate this file after connecting your Supabase project:
// supabase gen types typescript --project-id <id> > src/types/database.ts
// Hand-authored to match supabase/migrations/001_schema.sql

export type AuthProvider = "email" | "google" | "github";
export type SubscriptionTier = "free" | "pro" | "premium";
export type TutorMode = "socratic" | "direct";
export type SessionType = "practice" | "mock_exam" | "ai_tutor" | "diagnostic";
export type QuestionType = "single_choice" | "multi_select";
export type ReportReason = "outdated" | "incorrect" | "unclear";
export type BadgeRarity = "common" | "rare" | "epic" | "legendary";

// ---- JSON shapes stored in JSONB columns ----

export interface QuestionOption {
  id: string;
  text: string;
  is_correct: boolean;
  explanation: string;
}

export interface StudyPlanWeek {
  week: number;
  focus_domains: string[]; // domain codes
  daily_minutes: number;
  goals: string[];
}

export interface MockExamConfig {
  mode: "full" | "half" | "quick";
  question_count: number;
  time_limit_minutes: number;
}

export interface BadgeCriteria {
  type:
    | "onboarding_complete"
    | "consecutive_correct"
    | "streak_days"
    | "domain_mastery"
    | "mock_exam_score"
    | "mock_exam_speed"
    | "questions_answered";
  threshold?: number;
  min_score?: number;
  time_percent_max?: number;
  mode?: "full" | "half" | "quick";
}

// ---- Table row types ----

export interface DbUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  auth_provider: AuthProvider;
  email_verified: boolean;
  timezone: string;
  created_at: string;
  last_active_at: string | null;
}

export interface DbUserProfile {
  user_id: string;
  current_exam_id: string | null;
  xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  streak_shields: number;
  last_study_date: string | null;
  subscription_tier: SubscriptionTier;
  subscription_expires_at: string | null;
  stripe_customer_id: string | null;
  daily_goal_minutes: number;
  onboarding_completed: boolean;
  tutor_mode_preference: TutorMode;
  daily_ai_messages_used: number;
  daily_ai_messages_reset_at: string | null;
  updated_at: string;
}

export interface DbExam {
  id: string;
  name: string;
  provider: string;
  code: string;
  domain_count: number;
  estimated_prep_hours: number | null;
  difficulty_rating: number | null;
  passing_score_percent: number;
  question_count: number;
  time_limit_minutes: number;
  is_active: boolean;
  created_at: string;
}

export interface DbDomain {
  id: string;
  exam_id: string;
  name: string;
  code: string;
  weight_percent: number;
  display_order: number;
  created_at: string;
}

export interface DbSubtopic {
  id: string;
  domain_id: string;
  name: string;
  prerequisite_subtopic_id: string | null;
  display_order: number;
  created_at: string;
}

export interface DbQuestion {
  id: string;
  domain_id: string;
  subtopic_id: string | null;
  type: QuestionType;
  content: string;
  options: QuestionOption[];
  explanation: string;
  difficulty: number;
  aws_doc_url: string;
  exam_objective_code: string;
  is_ai_generated: boolean;
  is_sme_verified: boolean;
  is_shadow_mode: boolean;
  is_active: boolean;
  report_count: number;
  staleness_flagged: boolean;
  times_answered: number;
  times_correct: number;
  created_at: string;
  updated_at: string;
}

export interface DbUserQuestionHistory {
  id: string;
  user_id: string;
  question_id: string;
  session_id: string | null;
  answered_correctly: boolean;
  selected_option_ids: string[];
  hint_used: boolean;
  time_spent_seconds: number | null;
  answered_at: string;
}

export interface DbUserDomainProgress {
  user_id: string;
  domain_id: string;
  mastery_percent: number;
  questions_answered: number;
  questions_correct: number;
  current_difficulty: number;
  consecutive_correct: number;
  consecutive_incorrect: number;
  last_practiced_at: string | null;
}

export interface DbUserSubtopicProgress {
  user_id: string;
  subtopic_id: string;
  mastery_percent: number;
  questions_answered: number;
  questions_correct: number;
  last_practiced_at: string | null;
}

export interface DbStudySession {
  id: string;
  user_id: string;
  exam_id: string;
  type: SessionType;
  started_at: string;
  ended_at: string | null;
  questions_answered: number;
  correct_answers: number;
  xp_earned: number;
  config: MockExamConfig | null;
}

export interface DbStudyPlan {
  id: string;
  user_id: string;
  exam_id: string;
  generated_at: string;
  target_exam_date: string | null;
  readiness_score_at_generation: number | null;
  weeks: StudyPlanWeek[];
  is_active: boolean;
}

export interface DbBadge {
  id: string;
  code: string;
  name: string;
  description: string;
  rarity: BadgeRarity;
  xp_reward: number;
  icon_name: string;
  criteria: BadgeCriteria;
}

export interface DbUserBadge {
  user_id: string;
  badge_id: string;
  earned_at: string;
}

export interface DbWeeklyXpSnapshot {
  user_id: string;
  week_start: string;
  xp_earned: number;
  exam_id: string | null;
}

export interface DbUserAiCosts {
  user_id: string;
  billing_month: string;
  ai_cost_usd: number;
  tutor_messages_sent: number;
  circuit_breaker_triggered: boolean;
  last_updated_at: string;
}

export interface DbQuestionReport {
  id: string;
  question_id: string;
  user_id: string;
  reason: ReportReason;
  notes: string | null;
  created_at: string;
}

export interface DbFlashcard {
  id: string;
  user_id: string;
  front: string;
  back: string;
  topic: string | null;
  domain_id: string | null;
  created_at: string;
}

// ---- Supabase Database generic type ----

export interface Database {
  public: {
    Tables: {
      users: {
        Row: DbUser;
        Insert: Omit<DbUser, "created_at"> & { created_at?: string };
        Update: Partial<Omit<DbUser, "id">>;
      };
      user_profiles: {
        Row: DbUserProfile;
        Insert: Partial<DbUserProfile> & { user_id: string };
        Update: Partial<Omit<DbUserProfile, "user_id">>;
      };
      exams: {
        Row: DbExam;
        Insert: Omit<DbExam, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<DbExam, "id">>;
      };
      domains: {
        Row: DbDomain;
        Insert: Omit<DbDomain, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<DbDomain, "id">>;
      };
      subtopics: {
        Row: DbSubtopic;
        Insert: Omit<DbSubtopic, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<DbSubtopic, "id">>;
      };
      questions: {
        Row: DbQuestion;
        Insert: Omit<DbQuestion, "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Omit<DbQuestion, "id">>;
      };
      user_question_history: {
        Row: DbUserQuestionHistory;
        Insert: Omit<DbUserQuestionHistory, "id" | "answered_at"> & { id?: string; answered_at?: string };
        Update: never;
      };
      user_domain_progress: {
        Row: DbUserDomainProgress;
        Insert: Partial<DbUserDomainProgress> & { user_id: string; domain_id: string };
        Update: Partial<Omit<DbUserDomainProgress, "user_id" | "domain_id">>;
      };
      user_subtopic_progress: {
        Row: DbUserSubtopicProgress;
        Insert: Partial<DbUserSubtopicProgress> & { user_id: string; subtopic_id: string };
        Update: Partial<Omit<DbUserSubtopicProgress, "user_id" | "subtopic_id">>;
      };
      study_sessions: {
        Row: DbStudySession;
        Insert: Omit<DbStudySession, "id" | "started_at"> & { id?: string; started_at?: string };
        Update: Partial<Omit<DbStudySession, "id">>;
      };
      study_plans: {
        Row: DbStudyPlan;
        Insert: Omit<DbStudyPlan, "id" | "generated_at"> & { id?: string; generated_at?: string };
        Update: Partial<Omit<DbStudyPlan, "id">>;
      };
      badges: {
        Row: DbBadge;
        Insert: Omit<DbBadge, "id"> & { id?: string };
        Update: Partial<Omit<DbBadge, "id">>;
      };
      user_badges: {
        Row: DbUserBadge;
        Insert: Omit<DbUserBadge, "earned_at"> & { earned_at?: string };
        Update: never;
      };
      weekly_xp_snapshots: {
        Row: DbWeeklyXpSnapshot;
        Insert: DbWeeklyXpSnapshot;
        Update: Pick<DbWeeklyXpSnapshot, "xp_earned">;
      };
      user_ai_costs: {
        Row: DbUserAiCosts;
        Insert: Partial<DbUserAiCosts> & { user_id: string; billing_month: string };
        Update: Partial<Omit<DbUserAiCosts, "user_id" | "billing_month">>;
      };
      question_reports: {
        Row: DbQuestionReport;
        Insert: Omit<DbQuestionReport, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: never;
      };
      flashcards: {
        Row: DbFlashcard;
        Insert: Omit<DbFlashcard, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<DbFlashcard, "id" | "user_id">>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      auth_provider_enum: AuthProvider;
      subscription_tier_enum: SubscriptionTier;
      tutor_mode_enum: TutorMode;
      session_type_enum: SessionType;
      question_type_enum: QuestionType;
      report_reason_enum: ReportReason;
      badge_rarity_enum: BadgeRarity;
    };
  };
}
