-- Migration 005: count_users_above_xp RPC
-- Called by leaderboard.getWeekly to compute the exact rank of a user
-- who is outside the top-N result page.
--
-- Returns the number of users with strictly MORE xp_earned than p_xp
-- in the given week (optionally filtered by exam). Rank = result + 1.

CREATE OR REPLACE FUNCTION public.count_users_above_xp(
  p_week_start DATE,
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
