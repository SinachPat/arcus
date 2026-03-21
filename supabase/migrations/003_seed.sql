-- ============================================================
-- SEED: AWS SAA-C03 exam, 6 domains, 9 badges
-- ============================================================

-- AWS SAA-C03 exam
insert into public.exams (
  id, name, provider, code, domain_count, estimated_prep_hours,
  difficulty_rating, passing_score_percent, question_count, time_limit_minutes, is_active
) values (
  'a1b2c3d4-0000-4000-8000-000000000001',
  'AWS Solutions Architect – Associate',
  'Amazon Web Services',
  'SAA-C03',
  6,
  80,
  3,
  72,
  65,
  130,
  true
);

-- 6 domains (weights sum to 100)
insert into public.domains (id, exam_id, name, code, weight_percent, display_order) values
  (
    'b1000000-0000-4000-8000-000000000001',
    'a1b2c3d4-0000-4000-8000-000000000001',
    'Design Resilient Architectures',
    'RESILIENT',
    30,
    1
  ),
  (
    'b1000000-0000-4000-8000-000000000002',
    'a1b2c3d4-0000-4000-8000-000000000001',
    'Design High-Performing Architectures',
    'PERFORMANCE',
    26,
    2
  ),
  (
    'b1000000-0000-4000-8000-000000000003',
    'a1b2c3d4-0000-4000-8000-000000000001',
    'Design Secure Applications and Architectures',
    'SECURITY',
    24,
    3
  ),
  (
    'b1000000-0000-4000-8000-000000000004',
    'a1b2c3d4-0000-4000-8000-000000000001',
    'Design Cost-Optimized Architectures',
    'COST',
    10,
    4
  ),
  (
    'b1000000-0000-4000-8000-000000000005',
    'a1b2c3d4-0000-4000-8000-000000000001',
    'Design Operationally Excellent Architectures',
    'OPERATIONS',
    6,
    5
  ),
  (
    'b1000000-0000-4000-8000-000000000006',
    'a1b2c3d4-0000-4000-8000-000000000001',
    'Continuous Improvement for Existing Solutions',
    'IMPROVEMENT',
    4,
    6
  );

-- 9 badges
insert into public.badges (code, name, description, rarity, xp_reward, icon_name, criteria) values
  (
    'first_steps',
    'First Steps',
    'Complete onboarding and the diagnostic quiz.',
    'common',
    50,
    'footprints',
    '{"type": "onboarding_complete"}'::jsonb
  ),
  (
    'quick_learner',
    'Quick Learner',
    'Answer 10 questions correctly in a row.',
    'common',
    100,
    'zap',
    '{"type": "consecutive_correct", "threshold": 10}'::jsonb
  ),
  (
    'week_warrior',
    'Week Warrior',
    'Maintain a 7-day study streak.',
    'rare',
    200,
    'flame',
    '{"type": "streak_days", "threshold": 7}'::jsonb
  ),
  (
    'domain_master',
    'Domain Master',
    'Reach 90% mastery in any domain.',
    'rare',
    300,
    'trophy',
    '{"type": "domain_mastery", "threshold": 90}'::jsonb
  ),
  (
    'iron_will',
    'Iron Will',
    'Maintain a 30-day study streak.',
    'epic',
    500,
    'shield',
    '{"type": "streak_days", "threshold": 30}'::jsonb
  ),
  (
    'perfect_score',
    'Perfect Score',
    'Score 100% on a full mock exam.',
    'epic',
    1000,
    'star',
    '{"type": "mock_exam_score", "min_score": 100, "mode": "full"}'::jsonb
  ),
  (
    'speed_demon',
    'Speed Demon',
    'Complete a full mock exam in under 60% of the time limit.',
    'epic',
    500,
    'timer',
    '{"type": "mock_exam_speed", "time_percent_max": 60, "mode": "full"}'::jsonb
  ),
  (
    'centurion',
    'Centurion',
    'Answer 1,000 questions.',
    'legendary',
    1000,
    'swords',
    '{"type": "questions_answered", "threshold": 1000}'::jsonb
  ),
  (
    'the_architect',
    'The Architect',
    'Score 85% or higher on a full mock exam.',
    'legendary',
    2000,
    'building',
    '{"type": "mock_exam_score", "min_score": 85, "mode": "full"}'::jsonb
  );
