-- ============================================================
-- ROW LEVEL SECURITY
-- All writes go through the service-role client server-side.
-- These policies govern what authenticated users can read/write
-- directly from the client (browser).
-- ============================================================

-- users
alter table public.users enable row level security;
create policy "users_select_own" on public.users for select using (auth.uid() = id);
create policy "users_update_own" on public.users for update using (auth.uid() = id);

-- user_profiles
alter table public.user_profiles enable row level security;
create policy "profiles_select_own" on public.user_profiles for select using (auth.uid() = user_id);
create policy "profiles_update_own" on public.user_profiles for update using (auth.uid() = user_id);

-- exams (public read, no client writes)
alter table public.exams enable row level security;
create policy "exams_select_all" on public.exams for select using (auth.role() = 'authenticated');

-- domains (public read, no client writes)
alter table public.domains enable row level security;
create policy "domains_select_all" on public.domains for select using (auth.role() = 'authenticated');

-- subtopics (public read, no client writes)
alter table public.subtopics enable row level security;
create policy "subtopics_select_all" on public.subtopics for select using (auth.role() = 'authenticated');

-- questions (public read, no client writes)
-- Excludes shadow mode and inactive questions from client
alter table public.questions enable row level security;
create policy "questions_select_active" on public.questions for select
  using (auth.role() = 'authenticated' and is_active = true and is_shadow_mode = false);

-- badges (public read, no client writes)
alter table public.badges enable row level security;
create policy "badges_select_all" on public.badges for select using (auth.role() = 'authenticated');

-- user_question_history
alter table public.user_question_history enable row level security;
create policy "uqh_select_own" on public.user_question_history for select using (auth.uid() = user_id);
create policy "uqh_insert_own" on public.user_question_history for insert with check (auth.uid() = user_id);

-- user_domain_progress
alter table public.user_domain_progress enable row level security;
create policy "udp_select_own" on public.user_domain_progress for select using (auth.uid() = user_id);

-- user_subtopic_progress
alter table public.user_subtopic_progress enable row level security;
create policy "usp_select_own" on public.user_subtopic_progress for select using (auth.uid() = user_id);

-- study_sessions
alter table public.study_sessions enable row level security;
create policy "sessions_select_own" on public.study_sessions for select using (auth.uid() = user_id);

-- study_plans
alter table public.study_plans enable row level security;
create policy "plans_select_own" on public.study_plans for select using (auth.uid() = user_id);

-- user_badges
alter table public.user_badges enable row level security;
create policy "user_badges_select_own" on public.user_badges for select using (auth.uid() = user_id);

-- weekly_xp_snapshots (all authenticated users can read — leaderboard)
alter table public.weekly_xp_snapshots enable row level security;
create policy "weekly_xp_select_all" on public.weekly_xp_snapshots for select using (auth.role() = 'authenticated');
create policy "weekly_xp_insert_own" on public.weekly_xp_snapshots for insert with check (auth.uid() = user_id);
create policy "weekly_xp_update_own" on public.weekly_xp_snapshots for update using (auth.uid() = user_id);

-- user_ai_costs (own rows only — never exposed to client in practice, service-role writes)
alter table public.user_ai_costs enable row level security;
create policy "ai_costs_select_own" on public.user_ai_costs for select using (auth.uid() = user_id);

-- question_reports (insert own, select own)
alter table public.question_reports enable row level security;
create policy "reports_select_own" on public.question_reports for select using (auth.uid() = user_id);
create policy "reports_insert_own" on public.question_reports for insert with check (auth.uid() = user_id);

-- flashcards (own rows only)
alter table public.flashcards enable row level security;
create policy "flashcards_select_own" on public.flashcards for select using (auth.uid() = user_id);
create policy "flashcards_insert_own" on public.flashcards for insert with check (auth.uid() = user_id);
create policy "flashcards_update_own" on public.flashcards for update using (auth.uid() = user_id);
create policy "flashcards_delete_own" on public.flashcards for delete using (auth.uid() = user_id);
