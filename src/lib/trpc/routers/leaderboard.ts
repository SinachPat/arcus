import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../init";
import { LEADERBOARD } from "@/lib/constants";

/** Today's UTC date as YYYY-MM-DD — matches getWeekStart() in study.ts / mock.ts. */
function currentWeekStart(): string {
  const now  = new Date();
  const yyyy = now.getUTCFullYear();
  const mm   = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd   = String(now.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export const leaderboardRouter = router({
  /** Weekly XP leaderboard — all users, optionally filtered by exam. */
  getWeekly: protectedProcedure
    .input(
      z.object({
        examId:   z.string().uuid().optional(),
        page:     z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(LEADERBOARD.PAGE_SIZE),
      })
    )
    .query(async ({ ctx, input }) => {
      const weekStart = currentWeekStart();
      const offset    = (input.page - 1) * input.pageSize;

      let query = ctx.supabase
        .from("weekly_xp_snapshots")
        .select("user_id, xp_earned, users!left(name, avatar_url), user_profiles!left(level)")
        .eq("week_start", weekStart)
        .order("xp_earned", { ascending: false })
        .range(offset, offset + input.pageSize - 1);

      if (input.examId) {
        query = query.eq("exam_id", input.examId);
      }

      const { data, error } = await query;
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      const rows = data ?? [];
      const topList = rows.map((row, index) => ({
        userId:        row.user_id,
        name:          (row.users as unknown as { name: string } | null)?.name ?? "Anonymous",
        avatarUrl:     (row.users as unknown as { avatar_url: string | null } | null)?.avatar_url ?? null,
        level:         (row.user_profiles as unknown as { level: number } | null)?.level ?? 1,
        xpEarned:      row.xp_earned,
        rank:          offset + index + 1,
        isCurrentUser: row.user_id === ctx.user.id,
      }));

      // If the current user is already visible in the top list, we're done.
      const alreadyInTop = topList.some((r) => r.isCurrentUser);
      if (alreadyInTop) return { topList, currentUserRow: null };

      // Fetch current user's own row first (need their XP to count rank).
      const snapshotRes = await ctx.supabase
        .from("weekly_xp_snapshots")
        .select("xp_earned, users!left(name, avatar_url), user_profiles!left(level)")
        .eq("week_start", weekStart)
        .eq("user_id", ctx.user.id)
        .maybeSingle();

      if (!snapshotRes.data) return { topList, currentUserRow: null };

      const userXP = snapshotRes.data.xp_earned;

      // Count how many users have strictly more XP — that's their rank minus 1.
      const { data: countData } = await ctx.supabase.rpc("count_users_above_xp", {
        p_week_start: weekStart,
        p_xp:         userXP,
        p_exam_id:    input.examId ?? null,
      });

      const userRank = ((countData as number | null) ?? 0) + 1;

      return {
        topList,
        currentUserRow: {
          userId:        ctx.user.id,
          name:          (snapshotRes.data.users as unknown as { name: string } | null)?.name ?? "Anonymous",
          avatarUrl:     (snapshotRes.data.users as unknown as { avatar_url: string | null } | null)?.avatar_url ?? null,
          level:         (snapshotRes.data.user_profiles as unknown as { level: number } | null)?.level ?? 1,
          xpEarned:      userXP,
          rank:          userRank,
          isCurrentUser: true,
        },
      };
    }),
});
