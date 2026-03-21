-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "vector";

-- Enums
create type auth_provider_enum as enum ('email', 'google', 'github');
create type subscription_tier_enum as enum ('free', 'pro', 'premium');
create type tutor_mode_enum as enum ('socratic', 'direct');
create type session_type_enum as enum ('practice', 'mock_exam', 'ai_tutor', 'diagnostic');
create type question_type_enum as enum ('single_choice', 'multi_select');
create type report_reason_enum as enum ('outdated', 'incorrect', 'unclear');
create type badge_rarity_enum as enum ('common', 'rare', 'epic', 'legendary');

-- users (mirrors auth.users)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email varchar(255) unique not null,
  name varchar(100) not null,
  avatar_url text,
  auth_provider auth_provider_enum not null default 'email',
  email_verified boolean default false,
  timezone varchar(50) not null default 'UTC',
  created_at timestamptz not null default now(),
  last_active_at timestamptz
);

-- user_profiles
create table public.user_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  current_exam_id uuid,
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  streak_shields integer not null default 0 check (streak_shields between 0 and 3),
  last_study_date date,
  subscription_tier subscription_tier_enum not null default 'free',
  subscription_expires_at timestamptz,
  stripe_customer_id varchar(100),
  daily_goal_minutes integer not null default 15,
  onboarding_completed boolean not null default false,
  tutor_mode_preference tutor_mode_enum not null default 'socratic',
  daily_ai_messages_used integer not null default 0,
  daily_ai_messages_reset_at date,
  updated_at timestamptz not null default now()
);

-- exams
create table public.exams (
  id uuid primary key default uuid_generate_v4(),
  name varchar(200) not null,
  provider varchar(100) not null,
  code varchar(50) not null unique,
  domain_count integer not null,
  estimated_prep_hours integer,
  difficulty_rating integer check (difficulty_rating between 1 and 5),
  passing_score_percent integer not null default 72,
  question_count integer not null default 65,
  time_limit_minutes integer not null default 130,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- domains
create table public.domains (
  id uuid primary key default uuid_generate_v4(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  name varchar(200) not null,
  code varchar(50) not null,
  weight_percent integer not null,
  display_order integer not null,
  created_at timestamptz not null default now()
);

-- subtopics
create table public.subtopics (
  id uuid primary key default uuid_generate_v4(),
  domain_id uuid not null references public.domains(id) on delete cascade,
  name varchar(200) not null,
  prerequisite_subtopic_id uuid references public.subtopics(id),
  display_order integer not null,
  created_at timestamptz not null default now()
);

-- questions
create table public.questions (
  id uuid primary key default uuid_generate_v4(),
  domain_id uuid not null references public.domains(id),
  subtopic_id uuid references public.subtopics(id),
  type question_type_enum not null,
  content text not null,
  options jsonb not null, -- array: [{id, text, is_correct, explanation}]
  explanation text not null,
  difficulty integer not null check (difficulty between 1 and 5),
  aws_doc_url text not null,
  exam_objective_code varchar(30) not null,
  is_ai_generated boolean not null default false,
  is_sme_verified boolean not null default false,
  is_shadow_mode boolean not null default false,
  is_active boolean not null default true,
  report_count integer not null default 0,
  staleness_flagged boolean not null default false,
  times_answered integer not null default 0,
  times_correct integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- user_question_history
create table public.user_question_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  session_id uuid,
  answered_correctly boolean not null,
  selected_option_ids jsonb not null,
  hint_used boolean not null default false,
  time_spent_seconds integer,
  answered_at timestamptz not null default now()
);

create index idx_uqh_user_question on public.user_question_history(user_id, question_id);
create index idx_uqh_user_recent on public.user_question_history(user_id, answered_at desc);

-- user_domain_progress
create table public.user_domain_progress (
  user_id uuid not null references public.users(id) on delete cascade,
  domain_id uuid not null references public.domains(id) on delete cascade,
  mastery_percent integer not null default 0 check (mastery_percent between 0 and 100),
  questions_answered integer not null default 0,
  questions_correct integer not null default 0,
  current_difficulty integer not null default 3 check (current_difficulty between 1 and 5),
  consecutive_correct integer not null default 0,
  consecutive_incorrect integer not null default 0,
  last_practiced_at timestamptz,
  primary key (user_id, domain_id)
);

-- user_subtopic_progress
create table public.user_subtopic_progress (
  user_id uuid not null references public.users(id) on delete cascade,
  subtopic_id uuid not null references public.subtopics(id) on delete cascade,
  mastery_percent integer not null default 0 check (mastery_percent between 0 and 100),
  questions_answered integer not null default 0,
  questions_correct integer not null default 0,
  last_practiced_at timestamptz,
  primary key (user_id, subtopic_id)
);

-- study_sessions
create table public.study_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  exam_id uuid not null references public.exams(id),
  type session_type_enum not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  questions_answered integer not null default 0,
  correct_answers integer not null default 0,
  xp_earned integer not null default 0,
  config jsonb
);

-- study_plans
create table public.study_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  exam_id uuid not null references public.exams(id),
  generated_at timestamptz not null default now(),
  target_exam_date date,
  readiness_score_at_generation integer,
  weeks jsonb not null,
  is_active boolean not null default true
);

-- badges
create table public.badges (
  id uuid primary key default uuid_generate_v4(),
  code varchar(50) unique not null,
  name varchar(100) not null,
  description text not null,
  rarity badge_rarity_enum not null,
  xp_reward integer not null default 0,
  icon_name varchar(50) not null,
  criteria jsonb not null
);

-- user_badges
create table public.user_badges (
  user_id uuid not null references public.users(id) on delete cascade,
  badge_id uuid not null references public.badges(id),
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

-- weekly_xp_snapshots
create table public.weekly_xp_snapshots (
  user_id uuid not null references public.users(id) on delete cascade,
  week_start date not null,
  xp_earned integer not null default 0,
  exam_id uuid references public.exams(id),
  primary key (user_id, week_start)
);

-- user_ai_costs
create table public.user_ai_costs (
  user_id uuid not null references public.users(id) on delete cascade,
  billing_month date not null,
  ai_cost_usd decimal(10,4) not null default 0,
  tutor_messages_sent integer not null default 0,
  circuit_breaker_triggered boolean not null default false,
  last_updated_at timestamptz not null default now(),
  primary key (user_id, billing_month)
);

-- question_reports
create table public.question_reports (
  id uuid primary key default uuid_generate_v4(),
  question_id uuid not null references public.questions(id),
  user_id uuid not null references public.users(id),
  reason report_reason_enum not null,
  notes text,
  created_at timestamptz not null default now()
);

-- flashcards
create table public.flashcards (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  front text not null,
  back text not null,
  topic varchar(100),
  domain_id uuid references public.domains(id),
  created_at timestamptz not null default now()
);
