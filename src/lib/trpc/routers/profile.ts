import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../router";

export const profileRouter = router({
  /** Full profile + gamification state. */
  get: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("user_profiles")
      .select("*, users(name, email, avatar_url, timezone)")
      .eq("user_id", ctx.user.id)
      .single();

    if (error) throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found." });
    return data;
  }),

  /** All badges the user has earned. */
  getAchievements: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("user_badges")
      .select("earned_at, badges(*)")
      .eq("user_id", ctx.user.id)
      .order("earned_at", { ascending: false });

    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return data ?? [];
  }),

  /** All badges in the system (for the badge showcase grid). */
  getAllBadges: protectedProcedure.query(async ({ ctx }) => {
    const [allBadges, earnedBadges] = await Promise.all([
      ctx.supabase.from("badges").select("*"),
      ctx.supabase.from("user_badges").select("badge_id").eq("user_id", ctx.user.id),
    ]);

    const earnedIds = new Set((earnedBadges.data ?? []).map((b) => b.badge_id));

    return (allBadges.data ?? []).map((badge) => ({
      ...badge,
      earned: earnedIds.has(badge.id),
    }));
  }),

  /** Update daily goal and tutor mode preference. */
  updatePreferences: protectedProcedure
    .input(
      z.object({
        dailyGoalMinutes:     z.number().int().min(5).max(120).optional(),
        tutorModePreference:  z.enum(["socratic", "direct"]).optional(),
        timezone:             z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updates: Record<string, unknown> = {};
      if (input.dailyGoalMinutes    !== undefined) updates.daily_goal_minutes    = input.dailyGoalMinutes;
      if (input.tutorModePreference !== undefined) updates.tutor_mode_preference = input.tutorModePreference;
      if (input.timezone !== undefined) {
        await ctx.supabase.from("users").update({ timezone: input.timezone }).eq("id", ctx.user.id);
      }

      if (Object.keys(updates).length > 0) {
        const { error } = await ctx.supabase
          .from("user_profiles")
          .update(updates)
          .eq("user_id", ctx.user.id);
        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return { success: true };
    }),

  /** Streak calendar — last 90 days of study_sessions. */
  getStreakCalendar: protectedProcedure.query(async ({ ctx }) => {
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const { data, error } = await ctx.supabase
      .from("study_sessions")
      .select("started_at")
      .eq("user_id", ctx.user.id)
      .gte("started_at", since.toISOString());

    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

    // Deduplicate to one entry per calendar day
    const days = new Set(
      (data ?? []).map((s) => new Date(s.started_at).toISOString().split("T")[0])
    );

    return Array.from(days).sort();
  }),
});
