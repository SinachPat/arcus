-- Migration 007: Change weekly_xp_snapshots.week_start from DATE to TEXT
-- so the leaderboard period can be any granularity (minute, day, week, etc.)
-- and update the count_users_above_xp RPC parameter type to match.

-- 1. Drop PK (includes week_start), change type, recreate PK
ALTER TABLE public.weekly_xp_snapshots
  DROP CONSTRAINT weekly_xp_snapshots_pkey;

ALTER TABLE public.weekly_xp_snapshots
  ALTER COLUMN week_start TYPE text USING week_start::text;

ALTER TABLE public.weekly_xp_snapshots
  ADD PRIMARY KEY (user_id, week_start);

-- 2. Recreate RPC with TEXT parameter
CREATE OR REPLACE FUNCTION public.count_users_above_xp(
  p_week_start TEXT,
  p_xp         INTEGER,
  p_exam_id    UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.weekly_xp_snapshots
  WHERE week_start = p_week_start
    AND xp_earned  > p_xp
    AND (p_exam_id IS NULL OR exam_id = p_exam_id);
$$;
