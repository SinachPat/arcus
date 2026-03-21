-- ============================================================
-- FULL DATABASE SETUP: Schema + RLS + Seed + Sample Questions
-- Run this ONCE in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/dmxaallhflqzjmlfpqot/sql/new
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- Enums (IF NOT EXISTS for idempotency)
DO $$ BEGIN CREATE TYPE auth_provider_enum AS ENUM ('email', 'google', 'github'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE subscription_tier_enum AS ENUM ('free', 'pro', 'premium'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE tutor_mode_enum AS ENUM ('socratic', 'direct'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE session_type_enum AS ENUM ('practice', 'mock_exam', 'ai_tutor', 'diagnostic'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE question_type_enum AS ENUM ('single_choice', 'multi_select'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE report_reason_enum AS ENUM ('outdated', 'incorrect', 'unclear'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE badge_rarity_enum AS ENUM ('common', 'rare', 'epic', 'legendary'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists public.users (
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

create table if not exists public.user_profiles (
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

create table if not exists public.exams (
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

create table if not exists public.domains (
  id uuid primary key default uuid_generate_v4(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  name varchar(200) not null,
  code varchar(50) not null,
  weight_percent integer not null,
  display_order integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.subtopics (
  id uuid primary key default uuid_generate_v4(),
  domain_id uuid not null references public.domains(id) on delete cascade,
  name varchar(200) not null,
  prerequisite_subtopic_id uuid references public.subtopics(id),
  display_order integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default uuid_generate_v4(),
  domain_id uuid not null references public.domains(id),
  subtopic_id uuid references public.subtopics(id),
  type question_type_enum not null,
  content text not null,
  options jsonb not null,
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

create table if not exists public.user_question_history (
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

create index if not exists idx_uqh_user_question on public.user_question_history(user_id, question_id);
create index if not exists idx_uqh_user_recent on public.user_question_history(user_id, answered_at desc);

create table if not exists public.user_domain_progress (
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

create table if not exists public.user_subtopic_progress (
  user_id uuid not null references public.users(id) on delete cascade,
  subtopic_id uuid not null references public.subtopics(id) on delete cascade,
  mastery_percent integer not null default 0 check (mastery_percent between 0 and 100),
  questions_answered integer not null default 0,
  questions_correct integer not null default 0,
  last_practiced_at timestamptz,
  primary key (user_id, subtopic_id)
);

create table if not exists public.study_sessions (
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

create table if not exists public.study_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  exam_id uuid not null references public.exams(id),
  generated_at timestamptz not null default now(),
  target_exam_date date,
  readiness_score_at_generation integer,
  weeks jsonb not null,
  is_active boolean not null default true
);

create table if not exists public.badges (
  id uuid primary key default uuid_generate_v4(),
  code varchar(50) unique not null,
  name varchar(100) not null,
  description text not null,
  rarity badge_rarity_enum not null,
  xp_reward integer not null default 0,
  icon_name varchar(50) not null,
  criteria jsonb not null
);

create table if not exists public.user_badges (
  user_id uuid not null references public.users(id) on delete cascade,
  badge_id uuid not null references public.badges(id),
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create table if not exists public.weekly_xp_snapshots (
  user_id uuid not null references public.users(id) on delete cascade,
  week_start date not null,
  xp_earned integer not null default 0,
  exam_id uuid references public.exams(id),
  primary key (user_id, week_start)
);

create table if not exists public.user_ai_costs (
  user_id uuid not null references public.users(id) on delete cascade,
  billing_month date not null,
  ai_cost_usd decimal(10,4) not null default 0,
  tutor_messages_sent integer not null default 0,
  circuit_breaker_triggered boolean not null default false,
  last_updated_at timestamptz not null default now(),
  primary key (user_id, billing_month)
);

create table if not exists public.question_reports (
  id uuid primary key default uuid_generate_v4(),
  question_id uuid not null references public.questions(id),
  user_id uuid not null references public.users(id),
  reason report_reason_enum not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.flashcards (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  front text not null,
  back text not null,
  topic varchar(100),
  domain_id uuid references public.domains(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.users enable row level security;
DO $$ BEGIN
  create policy "users_select_own" on public.users for select using (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create policy "users_update_own" on public.users for update using (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

alter table public.user_profiles enable row level security;
DO $$ BEGIN
  create policy "profiles_select_own" on public.user_profiles for select using (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create policy "profiles_update_own" on public.user_profiles for update using (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

alter table public.exams enable row level security;
DO $$ BEGIN
  create policy "exams_select_all" on public.exams for select using (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

alter table public.domains enable row level security;
DO $$ BEGIN
  create policy "domains_select_all" on public.domains for select using (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

alter table public.subtopics enable row level security;
DO $$ BEGIN
  create policy "subtopics_select_all" on public.subtopics for select using (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

alter table public.questions enable row level security;
DO $$ BEGIN
  create policy "questions_select_active" on public.questions for select
    using (auth.role() = 'authenticated' and is_active = true and is_shadow_mode = false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

alter table public.badges enable row level security;
DO $$ BEGIN
  create policy "badges_select_all" on public.badges for select using (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

alter table public.user_question_history enable row level security;
DO $$ BEGIN
  create policy "uqh_select_own" on public.user_question_history for select using (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create policy "uqh_insert_own" on public.user_question_history for insert with check (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

alter table public.user_domain_progress enable row level security;
DO $$ BEGIN
  create policy "udp_select_own" on public.user_domain_progress for select using (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

alter table public.user_subtopic_progress enable row level security;
DO $$ BEGIN
  create policy "usp_select_own" on public.user_subtopic_progress for select using (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

alter table public.study_sessions enable row level security;
DO $$ BEGIN
  create policy "sessions_select_own" on public.study_sessions for select using (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

alter table public.study_plans enable row level security;
DO $$ BEGIN
  create policy "plans_select_own" on public.study_plans for select using (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

alter table public.user_badges enable row level security;
DO $$ BEGIN
  create policy "user_badges_select_own" on public.user_badges for select using (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

alter table public.weekly_xp_snapshots enable row level security;
DO $$ BEGIN
  create policy "weekly_xp_select_all" on public.weekly_xp_snapshots for select using (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create policy "weekly_xp_insert_own" on public.weekly_xp_snapshots for insert with check (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create policy "weekly_xp_update_own" on public.weekly_xp_snapshots for update using (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

alter table public.user_ai_costs enable row level security;
DO $$ BEGIN
  create policy "ai_costs_select_own" on public.user_ai_costs for select using (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

alter table public.question_reports enable row level security;
DO $$ BEGIN
  create policy "reports_select_own" on public.question_reports for select using (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create policy "reports_insert_own" on public.question_reports for insert with check (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

alter table public.flashcards enable row level security;
DO $$ BEGIN
  create policy "flashcards_select_own" on public.flashcards for select using (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create policy "flashcards_insert_own" on public.flashcards for insert with check (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create policy "flashcards_update_own" on public.flashcards for update using (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create policy "flashcards_delete_own" on public.flashcards for delete using (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- SEED: Exam, Domains, Badges
-- ============================================================

insert into public.exams (id, name, provider, code, domain_count, estimated_prep_hours, difficulty_rating, passing_score_percent, question_count, time_limit_minutes, is_active)
values ('a1b2c3d4-0000-4000-8000-000000000001', 'AWS Solutions Architect – Associate', 'Amazon Web Services', 'SAA-C03', 6, 80, 3, 72, 65, 130, true)
on conflict (code) do nothing;

insert into public.domains (id, exam_id, name, code, weight_percent, display_order) values
  ('b1000000-0000-4000-8000-000000000001', 'a1b2c3d4-0000-4000-8000-000000000001', 'Design Resilient Architectures', 'RESILIENT', 30, 1),
  ('b1000000-0000-4000-8000-000000000002', 'a1b2c3d4-0000-4000-8000-000000000001', 'Design High-Performing Architectures', 'PERFORMANCE', 26, 2),
  ('b1000000-0000-4000-8000-000000000003', 'a1b2c3d4-0000-4000-8000-000000000001', 'Design Secure Applications and Architectures', 'SECURITY', 24, 3),
  ('b1000000-0000-4000-8000-000000000004', 'a1b2c3d4-0000-4000-8000-000000000001', 'Design Cost-Optimized Architectures', 'COST', 10, 4),
  ('b1000000-0000-4000-8000-000000000005', 'a1b2c3d4-0000-4000-8000-000000000001', 'Design Operationally Excellent Architectures', 'OPERATIONS', 6, 5),
  ('b1000000-0000-4000-8000-000000000006', 'a1b2c3d4-0000-4000-8000-000000000001', 'Continuous Improvement for Existing Solutions', 'IMPROVEMENT', 4, 6)
on conflict (id) do nothing;

insert into public.badges (code, name, description, rarity, xp_reward, icon_name, criteria) values
  ('first_steps', 'First Steps', 'Complete onboarding and the diagnostic quiz.', 'common', 50, 'footprints', '{"type": "onboarding_complete"}'::jsonb),
  ('quick_learner', 'Quick Learner', 'Answer 10 questions correctly in a row.', 'common', 100, 'zap', '{"type": "consecutive_correct", "threshold": 10}'::jsonb),
  ('week_warrior', 'Week Warrior', 'Maintain a 7-day study streak.', 'rare', 200, 'flame', '{"type": "streak_days", "threshold": 7}'::jsonb),
  ('domain_master', 'Domain Master', 'Reach 90% mastery in any domain.', 'rare', 300, 'trophy', '{"type": "domain_mastery", "threshold": 90}'::jsonb),
  ('iron_will', 'Iron Will', 'Maintain a 30-day study streak.', 'epic', 500, 'shield', '{"type": "streak_days", "threshold": 30}'::jsonb),
  ('perfect_score', 'Perfect Score', 'Score 100% on a full mock exam.', 'epic', 1000, 'star', '{"type": "mock_exam_score", "min_score": 100, "mode": "full"}'::jsonb),
  ('speed_demon', 'Speed Demon', 'Complete a full mock exam in under 60% of the time limit.', 'epic', 500, 'timer', '{"type": "mock_exam_speed", "time_percent_max": 60, "mode": "full"}'::jsonb),
  ('centurion', 'Centurion', 'Answer 1,000 questions.', 'legendary', 1000, 'swords', '{"type": "questions_answered", "threshold": 1000}'::jsonb),
  ('the_architect', 'The Architect', 'Score 85% or higher on a full mock exam.', 'legendary', 2000, 'building', '{"type": "mock_exam_score", "min_score": 85, "mode": "full"}'::jsonb)
on conflict (code) do nothing;

-- ============================================================
-- SAMPLE QUESTIONS (24 questions, 4 per domain)
-- These cover all 6 SAA-C03 domains for the diagnostic quiz
-- ============================================================

-- Domain 1: Design Resilient Architectures (4 questions)
insert into public.questions (domain_id, type, content, options, explanation, difficulty, aws_doc_url, exam_objective_code) values
(
  'b1000000-0000-4000-8000-000000000001', 'single_choice',
  'A company needs to ensure their web application remains available even if an entire AWS Availability Zone fails. Which architecture best achieves this?',
  '[{"id":"a1","text":"Deploy the application on a single large EC2 instance with enhanced networking","is_correct":false},{"id":"a2","text":"Use an Auto Scaling group spanning multiple Availability Zones behind an Application Load Balancer","is_correct":true},{"id":"a3","text":"Deploy the application on a single EC2 instance with an Elastic IP","is_correct":false},{"id":"a4","text":"Use a single NAT Gateway in one Availability Zone","is_correct":false}]',
  'An Auto Scaling group spanning multiple AZs behind an ALB ensures that if one AZ fails, instances in other AZs continue serving traffic. The ALB automatically routes traffic only to healthy instances.',
  2, 'https://docs.aws.amazon.com/autoscaling/ec2/userguide/auto-scaling-benefits.html', 'SAA-C03-1.1'
),
(
  'b1000000-0000-4000-8000-000000000001', 'single_choice',
  'A solutions architect needs to design a disaster recovery strategy with an RTO of 1 hour and RPO of 15 minutes for a critical database. Which approach is most appropriate?',
  '[{"id":"b1","text":"Use daily snapshots stored in S3 with cross-region replication","is_correct":false},{"id":"b2","text":"Create an Amazon RDS Multi-AZ deployment with automated backups and read replicas in another region","is_correct":true},{"id":"b3","text":"Use AWS Backup with a 24-hour backup frequency","is_correct":false},{"id":"b4","text":"Manually export the database weekly to an S3 bucket","is_correct":false}]',
  'RDS Multi-AZ with automated backups provides continuous replication (RPO near zero within the region) and read replicas in another region enable fast failover (RTO under 1 hour). Automated backups support point-in-time recovery within the retention window.',
  3, 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZSingleStandby.html', 'SAA-C03-1.2'
),
(
  'b1000000-0000-4000-8000-000000000001', 'single_choice',
  'Which AWS service provides a fully managed message queuing service that helps decouple application components?',
  '[{"id":"c1","text":"Amazon SNS","is_correct":false},{"id":"c2","text":"Amazon SQS","is_correct":true},{"id":"c3","text":"Amazon Kinesis","is_correct":false},{"id":"c4","text":"AWS Step Functions","is_correct":false}]',
  'Amazon SQS is a fully managed message queuing service that enables decoupling of application components. SNS is for pub/sub notifications, Kinesis is for streaming data, and Step Functions is for workflow orchestration.',
  1, 'https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html', 'SAA-C03-1.3'
),
(
  'b1000000-0000-4000-8000-000000000001', 'single_choice',
  'A company wants to migrate a legacy monolithic application to AWS and break it into microservices. Which combination of services would help manage service discovery and communication?',
  '[{"id":"d1","text":"Amazon ECS with AWS Cloud Map and Application Load Balancer","is_correct":true},{"id":"d2","text":"A single large EC2 instance running all microservices","is_correct":false},{"id":"d3","text":"Amazon S3 with CloudFront","is_correct":false},{"id":"d4","text":"AWS Direct Connect with a VPN","is_correct":false}]',
  'Amazon ECS manages containerized microservices, AWS Cloud Map provides service discovery, and an ALB routes traffic between services. This combination enables a well-architected microservices architecture.',
  3, 'https://docs.aws.amazon.com/cloud-map/latest/dg/what-is-cloud-map.html', 'SAA-C03-1.4'
);

-- Domain 2: Design High-Performing Architectures (4 questions)
insert into public.questions (domain_id, type, content, options, explanation, difficulty, aws_doc_url, exam_objective_code) values
(
  'b1000000-0000-4000-8000-000000000002', 'single_choice',
  'A web application needs to serve static assets (images, CSS, JavaScript) to users worldwide with the lowest possible latency. Which service should be used?',
  '[{"id":"e1","text":"Amazon S3 with Transfer Acceleration","is_correct":false},{"id":"e2","text":"Amazon CloudFront with S3 as the origin","is_correct":true},{"id":"e3","text":"Amazon EC2 with enhanced networking","is_correct":false},{"id":"e4","text":"AWS Global Accelerator","is_correct":false}]',
  'Amazon CloudFront is a CDN that caches static content at edge locations worldwide, providing the lowest latency for static asset delivery. S3 Transfer Acceleration speeds uploads, not content delivery.',
  1, 'https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html', 'SAA-C03-2.1'
),
(
  'b1000000-0000-4000-8000-000000000002', 'single_choice',
  'An application requires a database that can handle millions of requests per second with single-digit millisecond latency for key-value lookups. Which AWS service is the best fit?',
  '[{"id":"f1","text":"Amazon RDS for MySQL","is_correct":false},{"id":"f2","text":"Amazon DynamoDB with DAX","is_correct":true},{"id":"f3","text":"Amazon Redshift","is_correct":false},{"id":"f4","text":"Amazon Aurora Serverless","is_correct":false}]',
  'DynamoDB is designed for high-throughput key-value workloads. With DAX (DynamoDB Accelerator), it provides microsecond read latency at millions of requests per second. RDS and Aurora are relational databases not optimized for this pattern.',
  2, 'https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html', 'SAA-C03-2.2'
),
(
  'b1000000-0000-4000-8000-000000000002', 'single_choice',
  'A company needs to process large volumes of streaming data in real time from IoT devices. Which service should they use?',
  '[{"id":"g1","text":"Amazon SQS","is_correct":false},{"id":"g2","text":"Amazon Kinesis Data Streams","is_correct":true},{"id":"g3","text":"Amazon SNS","is_correct":false},{"id":"g4","text":"AWS Batch","is_correct":false}]',
  'Amazon Kinesis Data Streams is designed for real-time processing of streaming data at scale. SQS is for message queuing (not real-time streaming), SNS is for notifications, and AWS Batch is for batch processing jobs.',
  2, 'https://docs.aws.amazon.com/streams/latest/dev/introduction.html', 'SAA-C03-2.3'
),
(
  'b1000000-0000-4000-8000-000000000002', 'single_choice',
  'Which Amazon EC2 instance type family is optimized for compute-intensive workloads such as batch processing, scientific modeling, and high-performance computing?',
  '[{"id":"h1","text":"T3 (General Purpose)","is_correct":false},{"id":"h2","text":"C6i (Compute Optimized)","is_correct":true},{"id":"h3","text":"R6i (Memory Optimized)","is_correct":false},{"id":"h4","text":"I3 (Storage Optimized)","is_correct":false}]',
  'C-family instances (Compute Optimized) are designed for compute-intensive workloads. T3 is general-purpose with burstable performance, R6i is memory-optimized, and I3 is storage-optimized for high I/O.',
  1, 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-types.html', 'SAA-C03-2.4'
);

-- Domain 3: Design Secure Applications (4 questions)
insert into public.questions (domain_id, type, content, options, explanation, difficulty, aws_doc_url, exam_objective_code) values
(
  'b1000000-0000-4000-8000-000000000003', 'single_choice',
  'A company needs to encrypt data at rest in Amazon S3 while maintaining full control over the encryption keys. Which encryption option should they use?',
  '[{"id":"i1","text":"SSE-S3 (S3-managed keys)","is_correct":false},{"id":"i2","text":"SSE-KMS with a customer-managed CMK","is_correct":true},{"id":"i3","text":"Client-side encryption with a hardcoded key","is_correct":false},{"id":"i4","text":"No encryption — S3 is secure by default","is_correct":false}]',
  'SSE-KMS with a customer-managed CMK provides encryption at rest while giving the customer full control over key rotation, access policies, and audit trails via CloudTrail. SSE-S3 uses AWS-managed keys with no customer control.',
  2, 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingKMSEncryption.html', 'SAA-C03-3.1'
),
(
  'b1000000-0000-4000-8000-000000000003', 'single_choice',
  'Which service should be used to manage and rotate database credentials, API keys, and other secrets securely?',
  '[{"id":"j1","text":"AWS Systems Manager Parameter Store (Standard)","is_correct":false},{"id":"j2","text":"AWS Secrets Manager","is_correct":true},{"id":"j3","text":"Amazon S3 with versioning","is_correct":false},{"id":"j4","text":"AWS Config","is_correct":false}]',
  'AWS Secrets Manager is purpose-built for managing secrets with automatic rotation, fine-grained access control, and built-in integrations with RDS and other services. Parameter Store Standard tier does not support automatic rotation.',
  2, 'https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html', 'SAA-C03-3.2'
),
(
  'b1000000-0000-4000-8000-000000000003', 'single_choice',
  'A solutions architect needs to restrict access to an S3 bucket so that only a specific CloudFront distribution can read the objects. What should they configure?',
  '[{"id":"k1","text":"S3 bucket policy allowing public read access","is_correct":false},{"id":"k2","text":"CloudFront Origin Access Control (OAC) with an S3 bucket policy","is_correct":true},{"id":"k3","text":"An S3 Access Point with a VPC endpoint","is_correct":false},{"id":"k4","text":"S3 Object Lock in governance mode","is_correct":false}]',
  'Origin Access Control (OAC) restricts S3 access so only the designated CloudFront distribution can read objects. The S3 bucket policy references the CloudFront distribution, blocking direct S3 access.',
  3, 'https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html', 'SAA-C03-3.3'
),
(
  'b1000000-0000-4000-8000-000000000003', 'single_choice',
  'Which AWS service provides centralized management for firewall rules across multiple accounts and automatically applies them to new resources?',
  '[{"id":"l1","text":"AWS WAF alone","is_correct":false},{"id":"l2","text":"AWS Firewall Manager","is_correct":true},{"id":"l3","text":"Amazon GuardDuty","is_correct":false},{"id":"l4","text":"AWS Shield Standard","is_correct":false}]',
  'AWS Firewall Manager centrally configures and manages firewall rules (WAF, Shield, Security Groups, Network Firewall) across multiple AWS accounts in an organization, automatically applying to new resources.',
  3, 'https://docs.aws.amazon.com/waf/latest/developerguide/fms-chapter.html', 'SAA-C03-3.4'
);

-- Domain 4: Design Cost-Optimized Architectures (4 questions)
insert into public.questions (domain_id, type, content, options, explanation, difficulty, aws_doc_url, exam_objective_code) values
(
  'b1000000-0000-4000-8000-000000000004', 'single_choice',
  'A company runs batch processing jobs that can tolerate interruptions and have flexible start times. Which EC2 purchasing option offers the highest cost savings?',
  '[{"id":"m1","text":"On-Demand Instances","is_correct":false},{"id":"m2","text":"Spot Instances","is_correct":true},{"id":"m3","text":"Reserved Instances (1-year)","is_correct":false},{"id":"m4","text":"Dedicated Hosts","is_correct":false}]',
  'Spot Instances offer up to 90% savings compared to On-Demand prices and are ideal for fault-tolerant, flexible workloads like batch processing. They can be interrupted with a 2-minute notice.',
  1, 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-spot-instances.html', 'SAA-C03-4.1'
),
(
  'b1000000-0000-4000-8000-000000000004', 'single_choice',
  'Which S3 storage class is the most cost-effective for data that is rarely accessed but requires rapid retrieval when needed?',
  '[{"id":"n1","text":"S3 Standard","is_correct":false},{"id":"n2","text":"S3 Standard-Infrequent Access (S3 Standard-IA)","is_correct":true},{"id":"n3","text":"S3 Glacier Deep Archive","is_correct":false},{"id":"n4","text":"S3 One Zone-Infrequent Access","is_correct":false}]',
  'S3 Standard-IA is designed for infrequently accessed data that needs millisecond retrieval. It costs less than S3 Standard but has a per-GB retrieval fee. Glacier Deep Archive is much cheaper but has 12-hour retrieval times.',
  1, 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html', 'SAA-C03-4.2'
),
(
  'b1000000-0000-4000-8000-000000000004', 'single_choice',
  'A company wants to optimize their AWS spending by identifying underutilized resources. Which AWS service provides this analysis?',
  '[{"id":"o1","text":"AWS CloudTrail","is_correct":false},{"id":"o2","text":"AWS Trusted Advisor (Cost Optimization checks)","is_correct":true},{"id":"o3","text":"Amazon CloudWatch Logs","is_correct":false},{"id":"o4","text":"AWS X-Ray","is_correct":false}]',
  'AWS Trusted Advisor includes Cost Optimization checks that identify underutilized resources like idle EC2 instances, unattached EBS volumes, and underutilized RDS instances, with actionable recommendations.',
  2, 'https://docs.aws.amazon.com/awssupport/latest/user/trusted-advisor.html', 'SAA-C03-4.3'
),
(
  'b1000000-0000-4000-8000-000000000004', 'single_choice',
  'An application uses Amazon DynamoDB with unpredictable traffic patterns — sometimes idle, sometimes thousands of requests per second. Which capacity mode minimizes costs?',
  '[{"id":"p1","text":"Provisioned capacity with auto scaling","is_correct":false},{"id":"p2","text":"On-demand capacity mode","is_correct":true},{"id":"p3","text":"Reserved capacity","is_correct":false},{"id":"p4","text":"Global tables with provisioned capacity","is_correct":false}]',
  'DynamoDB on-demand mode charges per request, making it cost-effective for unpredictable workloads. You pay only for what you use without needing to provision capacity. Provisioned mode is cheaper for predictable, steady workloads.',
  2, 'https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadWriteCapacityMode.html', 'SAA-C03-4.4'
);

-- Domain 5: Design Operationally Excellent Architectures (4 questions)
insert into public.questions (domain_id, type, content, options, explanation, difficulty, aws_doc_url, exam_objective_code) values
(
  'b1000000-0000-4000-8000-000000000005', 'single_choice',
  'A company wants to automate the deployment of infrastructure changes with version control and rollback capability. Which service should they use?',
  '[{"id":"q1","text":"AWS Management Console","is_correct":false},{"id":"q2","text":"AWS CloudFormation","is_correct":true},{"id":"q3","text":"Amazon EC2 User Data scripts","is_correct":false},{"id":"q4","text":"AWS Artifact","is_correct":false}]',
  'AWS CloudFormation enables Infrastructure as Code (IaC), allowing you to define infrastructure in templates stored in version control. It supports rollback on failure and change sets for safe updates.',
  1, 'https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/Welcome.html', 'SAA-C03-5.1'
),
(
  'b1000000-0000-4000-8000-000000000005', 'single_choice',
  'Which AWS service provides a unified view of operational health across AWS resources and automatically aggregates, organizes, and prioritizes operational issues?',
  '[{"id":"r1","text":"Amazon CloudWatch","is_correct":false},{"id":"r2","text":"AWS Systems Manager OpsCenter","is_correct":true},{"id":"r3","text":"AWS Config","is_correct":false},{"id":"r4","text":"AWS Personal Health Dashboard","is_correct":false}]',
  'AWS Systems Manager OpsCenter provides a central location to view, investigate, and resolve operational issues. It aggregates issues from CloudWatch, Config, and other sources, with runbook automation for remediation.',
  3, 'https://docs.aws.amazon.com/systems-manager/latest/userguide/OpsCenter.html', 'SAA-C03-5.2'
),
(
  'b1000000-0000-4000-8000-000000000005', 'single_choice',
  'A team needs to track all API calls made in their AWS account for security auditing. Which service should they enable?',
  '[{"id":"s1","text":"Amazon CloudWatch Metrics","is_correct":false},{"id":"s2","text":"AWS CloudTrail","is_correct":true},{"id":"s3","text":"AWS Trusted Advisor","is_correct":false},{"id":"s4","text":"Amazon VPC Flow Logs","is_correct":false}]',
  'AWS CloudTrail records all API calls made in your AWS account, providing a complete audit trail. It logs who made the call, when, from where, and what was changed — essential for security and compliance.',
  1, 'https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-user-guide.html', 'SAA-C03-5.3'
),
(
  'b1000000-0000-4000-8000-000000000005', 'single_choice',
  'Which deployment strategy allows a new application version to be tested by routing a small percentage of traffic to it before full rollout?',
  '[{"id":"t1","text":"All-at-once deployment","is_correct":false},{"id":"t2","text":"Canary deployment","is_correct":true},{"id":"t3","text":"Blue/green deployment","is_correct":false},{"id":"t4","text":"Rolling deployment with batch size equal to fleet size","is_correct":false}]',
  'A canary deployment routes a small percentage of traffic (e.g., 10%) to the new version first. If metrics look healthy, traffic is gradually shifted. This minimizes blast radius compared to all-at-once deployments.',
  2, 'https://docs.aws.amazon.com/codedeploy/latest/userguide/deployment-configurations.html', 'SAA-C03-5.4'
);

-- Domain 6: Continuous Improvement for Existing Solutions (4 questions)
insert into public.questions (domain_id, type, content, options, explanation, difficulty, aws_doc_url, exam_objective_code) values
(
  'b1000000-0000-4000-8000-000000000006', 'single_choice',
  'A company is running a self-managed MySQL database on EC2. They want to reduce operational overhead while maintaining compatibility. What should they migrate to?',
  '[{"id":"u1","text":"Amazon DynamoDB","is_correct":false},{"id":"u2","text":"Amazon RDS for MySQL or Amazon Aurora MySQL-Compatible","is_correct":true},{"id":"u3","text":"Amazon ElastiCache for Redis","is_correct":false},{"id":"u4","text":"Amazon Redshift","is_correct":false}]',
  'Amazon RDS for MySQL or Aurora MySQL-Compatible provides full MySQL compatibility with managed backups, patching, scaling, and high availability — eliminating the operational overhead of self-managed databases.',
  1, 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Welcome.html', 'SAA-C03-6.1'
),
(
  'b1000000-0000-4000-8000-000000000006', 'single_choice',
  'An application currently uses polling to check for new messages in a queue every 5 seconds, consuming unnecessary compute. Which SQS feature can reduce this overhead?',
  '[{"id":"v1","text":"Short polling with a 1-second interval","is_correct":false},{"id":"v2","text":"Long polling with WaitTimeSeconds set to 20","is_correct":true},{"id":"v3","text":"FIFO queue mode","is_correct":false},{"id":"v4","text":"Dead letter queue","is_correct":false}]',
  'SQS long polling (WaitTimeSeconds up to 20 seconds) keeps the connection open until a message arrives or the timeout expires. This eliminates empty responses and reduces the number of API calls, lowering costs and compute usage.',
  2, 'https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-long-polling.html', 'SAA-C03-6.2'
),
(
  'b1000000-0000-4000-8000-000000000006', 'single_choice',
  'A solutions architect wants to automatically move S3 objects to cheaper storage classes as they age. Which S3 feature should they configure?',
  '[{"id":"w1","text":"S3 Versioning","is_correct":false},{"id":"w2","text":"S3 Lifecycle policies","is_correct":true},{"id":"w3","text":"S3 Cross-Region Replication","is_correct":false},{"id":"w4","text":"S3 Object Lock","is_correct":false}]',
  'S3 Lifecycle policies automatically transition objects between storage classes (e.g., Standard → IA → Glacier) based on age, and can expire objects after a specified time. This optimizes storage costs without manual intervention.',
  1, 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html', 'SAA-C03-6.3'
),
(
  'b1000000-0000-4000-8000-000000000006', 'single_choice',
  'A company wants to improve the performance of their existing application by caching frequently accessed database queries. Which AWS service should they integrate?',
  '[{"id":"x1","text":"Amazon S3","is_correct":false},{"id":"x2","text":"Amazon ElastiCache (Redis or Memcached)","is_correct":true},{"id":"x3","text":"AWS Lambda","is_correct":false},{"id":"x4","text":"Amazon SQS","is_correct":false}]',
  'Amazon ElastiCache provides in-memory caching with Redis or Memcached, dramatically reducing database load and improving response times for frequently accessed data. It integrates seamlessly with existing applications.',
  1, 'https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/WhatIs.html', 'SAA-C03-6.4'
);

-- ============================================================
-- TRIGGER: Auto-create user profile on auth signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name, auth_provider)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    case
      when new.raw_app_meta_data->>'provider' = 'google' then 'google'::auth_provider_enum
      when new.raw_app_meta_data->>'provider' = 'github' then 'github'::auth_provider_enum
      else 'email'::auth_provider_enum
    end
  )
  on conflict (id) do nothing;

  insert into public.user_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

-- Drop existing trigger if it exists, then recreate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Done!
select 'Setup complete! Tables: ' || (select count(*) from information_schema.tables where table_schema = 'public') || ', Exams: ' || (select count(*) from exams) || ', Domains: ' || (select count(*) from domains) || ', Badges: ' || (select count(*) from badges) || ', Questions: ' || (select count(*) from questions) as result;
