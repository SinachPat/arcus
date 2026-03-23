import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { generateObject } from "ai";
import { router, protectedProcedure } from "../init";
import { anthropic } from "@/lib/ai/index";
import { SAA_C03_EXAM_ID, SAA_C03_DOMAIN_WEIGHTS, AI_MODELS } from "@/lib/constants";

// ── helpers ────────────────────────────────────────────────────────────────

function weightedReadiness(
  domains: { id: string; weight_percent: number }[],
  correctMap: Record<string, number>,
  totalMap: Record<string, number>,
): number {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const d of domains) {
    const correct = correctMap[d.id] ?? 0;
    const total   = totalMap[d.id]   ?? 0;
    const acc     = total > 0 ? (correct / total) * 100 : 0;
    const weight  = SAA_C03_DOMAIN_WEIGHTS[d.id] ?? d.weight_percent;
    weightedSum  += acc * weight;
    totalWeight  += weight;
  }
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

// ── router ─────────────────────────────────────────────────────────────────

export const progressRouter = router({

  // ── existing (unchanged) ──────────────────────────────────────────────

  /** Weighted readiness score (0–100) + per-domain breakdown. */
  getReadiness: protectedProcedure
    .input(z.object({ examId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [domainsRes, progressRes] = await Promise.all([
        ctx.supabase
          .from("domains")
          .select("id, code, weight_percent")
          .eq("exam_id", input.examId),
        ctx.supabase
          .from("user_domain_progress")
          .select("domain_id, mastery_percent")
          .eq("user_id", ctx.user!.id),
      ]);

      if (domainsRes.error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: domainsRes.error.message });

      const progressMap = new Map(
        (progressRes.data ?? []).map((p) => [p.domain_id, p.mastery_percent])
      );

      let weightedSum = 0;
      let totalWeight = 0;
      const byDomain: Record<string, number> = {};

      for (const domain of domainsRes.data ?? []) {
        const mastery = progressMap.get(domain.id) ?? 0;
        const weight  = SAA_C03_DOMAIN_WEIGHTS[domain.id] ?? domain.weight_percent;
        weightedSum  += mastery * weight;
        totalWeight  += weight;
        byDomain[domain.id] = mastery;
      }

      const overall = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
      return { overall, byDomain };
    }),

  /** 7-day rolling accuracy + study time per domain. */
  getStats: protectedProcedure
    .input(z.object({
      examId: z.string().uuid(),
      days:   z.number().int().min(1).max(90).default(7),
    }))
    .query(async ({ ctx, input }) => {
      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const { data: sessions, error } = await ctx.supabase
        .from("study_sessions")
        .select("started_at, ended_at, questions_answered, correct_answers, type")
        .eq("user_id", ctx.user!.id)
        .eq("exam_id", input.examId)
        .gte("started_at", since.toISOString())
        .order("started_at");

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      const totalMinutes   = (sessions ?? []).reduce((acc, s) => {
        if (!s.ended_at) return acc;
        return acc + (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000;
      }, 0);
      const totalAnswered  = (sessions ?? []).reduce((acc, s) => acc + (s.questions_answered ?? 0), 0);
      const totalCorrect   = (sessions ?? []).reduce((acc, s) => acc + (s.correct_answers   ?? 0), 0);
      const accuracy       = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

      return {
        totalStudyMinutes:      Math.round(totalMinutes),
        totalQuestionsAnswered: totalAnswered,
        accuracyPercent:        accuracy,
      };
    }),

  /** Per-domain progress rows for the heatmap. */
  getDomainProgress: protectedProcedure
    .input(z.object({ examId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from("user_domain_progress")
        .select("*, domains(name, code, weight_percent, display_order)")
        .eq("user_id", ctx.user!.id);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      void input;
      return data ?? [];
    }),

  // ── new procedures ────────────────────────────────────────────────────

  /**
   * 30-day readiness score trend derived by replaying cumulative question
   * accuracy across all 6 domains with their exam weights.
   */
  getReadinessTrend: protectedProcedure
    .input(z.object({ days: z.number().int().min(7).max(90).default(30) }))
    .query(async ({ ctx, input }) => {
      const [historyRes, domainsRes] = await Promise.all([
        ctx.supabase
          .from("user_question_history")
          .select("answered_at, answered_correctly, questions(domain_id)")
          .eq("user_id", ctx.user!.id)
          .order("answered_at"),
        ctx.supabase
          .from("domains")
          .select("id, weight_percent")
          .eq("exam_id", SAA_C03_EXAM_ID),
      ]);

      const history = historyRes.data ?? [];
      const domains = domainsRes.data ?? [];

      // Replay history: accumulate running correct/total per domain
      const runningCorrect: Record<string, number> = {};
      const runningTotal:   Record<string, number> = {};
      const dailyScores     = new Map<string, number>();

      for (const entry of history) {
        const date     = entry.answered_at.slice(0, 10);
        const domainId = (entry.questions as unknown as { domain_id: string } | null)?.domain_id;
        if (!domainId) continue;

        runningCorrect[domainId] = (runningCorrect[domainId] ?? 0) + (entry.answered_correctly ? 1 : 0);
        runningTotal[domainId]   = (runningTotal[domainId]   ?? 0) + 1;

        dailyScores.set(date, weightedReadiness(domains, runningCorrect, runningTotal));
      }

      // Filter to last `days` days
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - input.days);

      const trend = Array.from(dailyScores.entries())
        .filter(([date]) => new Date(date) >= cutoff)
        .map(([date, score]) => ({ date, score }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const currentScore = trend.length > 0 ? trend[trend.length - 1].score : 0;

      // Week-over-week delta: find score closest to 7 days ago
      const weekAgoDate  = new Date();
      weekAgoDate.setDate(weekAgoDate.getDate() - 7);
      const weekAgoStr   = weekAgoDate.toISOString().slice(0, 10);
      const allEntries   = Array.from(dailyScores.entries()).sort(([a], [b]) => a.localeCompare(b));
      const weekAgoPair  = allEntries.filter(([d]) => d <= weekAgoStr).pop();
      const scoreWeekAgo = weekAgoPair?.[1] ?? 0;
      const deltaThisWeek = currentScore - scoreWeekAgo;

      return { trend, currentScore, deltaThisWeek };
    }),

  /** Daily study time in minutes for the last N days (for bar chart). */
  getStudyTime: protectedProcedure
    .input(z.object({ days: z.number().int().min(1).max(90).default(14) }))
    .query(async ({ ctx, input }) => {
      const since = new Date();
      since.setDate(since.getDate() - input.days + 1);
      since.setHours(0, 0, 0, 0);

      const { data: sessions } = await ctx.supabase
        .from("study_sessions")
        .select("started_at, ended_at")
        .eq("user_id", ctx.user!.id)
        .gte("started_at", since.toISOString())
        .not("ended_at", "is", null)
        .order("started_at");

      // Pre-fill all days with 0
      const byDate = new Map<string, number>();
      for (let i = 0; i < input.days; i++) {
        const d = new Date(since);
        d.setDate(d.getDate() + i);
        byDate.set(d.toISOString().slice(0, 10), 0);
      }

      for (const session of sessions ?? []) {
        if (!session.ended_at) continue;
        const date = session.started_at.slice(0, 10);
        const mins = (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 60000;
        byDate.set(date, (byDate.get(date) ?? 0) + mins);
      }

      const daily = Array.from(byDate.entries())
        .map(([date, minutes]) => ({ date, minutes: Math.round(minutes) }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const weeklyAvgMinutes = daily.length > 0
        ? Math.round(daily.reduce((s, d) => s + d.minutes, 0) / daily.length)
        : 0;

      return { daily, weeklyAvgMinutes };
    }),

  /**
   * Per-domain accuracy sparklines for last 7 days, plus current accuracy
   * and week-over-week delta.
   */
  getAccuracyTrends: protectedProcedure
    .query(async ({ ctx }) => {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      since.setHours(0, 0, 0, 0);

      const [historyRes, domainsRes, progressRes] = await Promise.all([
        ctx.supabase
          .from("user_question_history")
          .select("answered_at, answered_correctly, questions(domain_id)")
          .eq("user_id", ctx.user!.id)
          .gte("answered_at", since.toISOString())
          .order("answered_at"),
        ctx.supabase
          .from("domains")
          .select("id, name, code")
          .eq("exam_id", SAA_C03_EXAM_ID)
          .order("display_order"),
        ctx.supabase
          .from("user_domain_progress")
          .select("domain_id, questions_answered, questions_correct")
          .eq("user_id", ctx.user!.id),
      ]);

      const history  = historyRes.data ?? [];
      const domains  = domainsRes.data ?? [];
      const progress = new Map((progressRes.data ?? []).map((p) => [p.domain_id, p]));

      return domains.map((domain) => {
        const domainHistory = history.filter(
          (h) => (h.questions as unknown as { domain_id: string } | null)?.domain_id === domain.id
        );

        // Daily buckets for last 7 days
        const byDate = new Map<string, { correct: number; total: number }>();
        for (let i = 0; i < 7; i++) {
          const d = new Date(since);
          d.setDate(d.getDate() + i);
          byDate.set(d.toISOString().slice(0, 10), { correct: 0, total: 0 });
        }
        for (const entry of domainHistory) {
          const date = entry.answered_at.slice(0, 10);
          const prev = byDate.get(date) ?? { correct: 0, total: 0 };
          byDate.set(date, {
            correct: prev.correct + (entry.answered_correctly ? 1 : 0),
            total:   prev.total   + 1,
          });
        }

        const sparkline = Array.from(byDate.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, { correct, total }]) => ({
            date,
            accuracy: total > 0 ? Math.round((correct / total) * 100) : null as number | null,
          }));

        const prog            = progress.get(domain.id);
        const currentAccuracy = prog && prog.questions_answered > 0
          ? Math.round((prog.questions_correct / prog.questions_answered) * 100)
          : 0;

        // Delta: recent 3 days vs earlier 4 days
        const withData  = sparkline.filter((s) => s.accuracy !== null);
        const recent    = withData.slice(-3);
        const earlier   = withData.slice(0, Math.max(withData.length - 3, 0));
        const avg       = (arr: typeof withData) =>
          arr.length ? arr.reduce((s, d) => s + (d.accuracy ?? 0), 0) / arr.length : null;
        const recentAvg  = avg(recent)  ?? currentAccuracy;
        const earlierAvg = avg(earlier) ?? currentAccuracy;
        const delta      = Math.round(recentAvg - earlierAvg);

        return {
          domainId:        domain.id,
          code:            domain.code,
          name:            domain.name,
          currentAccuracy,
          deltaPercent:    delta,
          sparkline:       sparkline.map((s) => ({ date: s.date, accuracy: s.accuracy ?? 0 })),
        };
      });
    }),

  /**
   * Aggregate stats: total questions answered, sessions, best streak,
   * mock exam count, subscription tier, and days studying.
   */
  getFullStats: protectedProcedure
    .query(async ({ ctx }) => {
      const [qRes, sRes, profileRes, mockRes, firstRes] = await Promise.all([
        ctx.supabase
          .from("user_question_history")
          .select("id", { count: "exact", head: true })
          .eq("user_id", ctx.user!.id),
        ctx.supabase
          .from("study_sessions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", ctx.user!.id),
        ctx.supabase
          .from("user_profiles")
          .select("longest_streak, subscription_tier")
          .eq("user_id", ctx.user!.id)
          .single(),
        ctx.supabase
          .from("study_sessions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", ctx.user!.id)
          .eq("type", "mock_exam"),
        ctx.supabase
          .from("study_sessions")
          .select("started_at")
          .eq("user_id", ctx.user!.id)
          .order("started_at", { ascending: true })
          .limit(1),
      ]);

      const firstDate   = firstRes.data?.[0]?.started_at
        ? new Date(firstRes.data[0].started_at)
        : new Date();
      const daysStudying = Math.max(1, Math.ceil((Date.now() - firstDate.getTime()) / 86_400_000));

      return {
        totalQuestions:   qRes.count    ?? 0,
        totalSessions:    sRes.count    ?? 0,
        bestStreak:       profileRes.data?.longest_streak  ?? 0,
        mockExamCount:    mockRes.count  ?? 0,
        subscriptionTier: (profileRes.data?.subscription_tier ?? "free") as "free" | "pro" | "premium",
        daysStudying,
      };
    }),

  /**
   * AI-powered predicted pass date (Premium users only, ≥7 days data, ≥1 mock).
   * Uses Claude to generate a motivating but conservative date range.
   */
  getPredictedPassDate: protectedProcedure
    .query(async ({ ctx }) => {
      // 1. Eligibility checks
      const { data: profile } = await ctx.supabase
        .from("user_profiles")
        .select("subscription_tier")
        .eq("user_id", ctx.user!.id)
        .single();

      if (profile?.subscription_tier !== "premium") {
        return { eligible: false as const, reason: "not_premium" as const };
      }

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [sessionCountRes, mockCountRes] = await Promise.all([
        ctx.supabase
          .from("study_sessions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", ctx.user!.id)
          .gte("started_at", sevenDaysAgo.toISOString()),
        ctx.supabase
          .from("study_sessions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", ctx.user!.id)
          .eq("type", "mock_exam"),
      ]);

      if ((sessionCountRes.count ?? 0) === 0) {
        return { eligible: false as const, reason: "insufficient_data" as const };
      }
      if ((mockCountRes.count ?? 0) === 0) {
        return { eligible: false as const, reason: "no_mock_exam" as const };
      }

      // 2. Gather context for AI
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

      const [domainProgressRes, domainsRes, mockScoresRes, recentSessionsRes] = await Promise.all([
        ctx.supabase
          .from("user_domain_progress")
          .select("domain_id, mastery_percent, questions_answered, questions_correct")
          .eq("user_id", ctx.user!.id),
        ctx.supabase
          .from("domains")
          .select("id, name, code, weight_percent")
          .eq("exam_id", SAA_C03_EXAM_ID)
          .order("display_order"),
        ctx.supabase
          .from("study_sessions")
          .select("correct_answers, questions_answered, ended_at")
          .eq("user_id", ctx.user!.id)
          .eq("type", "mock_exam")
          .order("ended_at", { ascending: false })
          .limit(5),
        ctx.supabase
          .from("study_sessions")
          .select("started_at, ended_at")
          .eq("user_id", ctx.user!.id)
          .gte("started_at", fourWeeksAgo.toISOString())
          .not("ended_at", "is", null),
      ]);

      const domains      = domainsRes.data        ?? [];
      const domainProg   = domainProgressRes.data  ?? [];
      const mockSessions = mockScoresRes.data      ?? [];
      const recentSess   = recentSessionsRes.data  ?? [];

      // Compute overall readiness from mastery
      const progMap = new Map(domainProg.map((p) => [p.domain_id, p]));
      let weightedSum = 0, totalWeight = 0;
      for (const d of domains) {
        const mastery = progMap.get(d.id)?.mastery_percent ?? 0;
        const weight  = SAA_C03_DOMAIN_WEIGHTS[d.id] ?? d.weight_percent;
        weightedSum  += mastery * weight;
        totalWeight  += weight;
      }
      const readinessScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

      // Weakest domains
      const weakest = domains
        .map((d) => ({
          name:    d.name,
          mastery: progMap.get(d.id)?.mastery_percent ?? 0,
        }))
        .sort((a, b) => a.mastery - b.mastery)
        .slice(0, 3)
        .map((d) => `${d.name} (${d.mastery}%)`);

      // Mock exam scores
      const mockScores = mockSessions
        .filter((s) => s.questions_answered > 0)
        .map((s) => Math.round((s.correct_answers / s.questions_answered) * 100));

      // Study consistency: sessions/week, avg minutes/session
      const totalRecentMins = recentSess.reduce((acc, s) => {
        if (!s.ended_at) return acc;
        return acc + (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000;
      }, 0);
      const sessionsPerWeek  = Math.round(recentSess.length / 4);
      const avgMinPerSession = recentSess.length > 0 ? Math.round(totalRecentMins / recentSess.length) : 0;

      // 3. Call Claude
      const PredictionSchema = z.object({
        estimatedDateRange: z.object({
          earliest: z.string(),
          latest:   z.string(),
        }),
        confidenceLevel:  z.enum(["low", "medium", "high"]),
        confidenceReason: z.string(),
      });

      try {
        const { object } = await generateObject({
          model:  anthropic(AI_MODELS.examAnalysis),
          schema: PredictionSchema,
          prompt: `Based on this student's AWS SAA-C03 preparation data, predict when they will be ready to pass the exam.

Current readiness score: ${readinessScore}/100
Weakest domains: ${weakest.join(", ")}
Mock exam scores (most recent first): ${mockScores.length > 0 ? mockScores.map((s) => `${s}%`).join(", ") : "none yet"}
Study consistency: ${sessionsPerWeek} sessions/week, ${avgMinPerSession} min avg/session
Today's date: ${new Date().toISOString().slice(0, 10)}

Give a date range (earliest to latest, minimum 7 days apart, never a single date) that is realistic but motivating.
Be conservative — it is better to over-prepare than to fail. The passing threshold is 72%.
Output confidence level: high if trending consistently upward AND scoring >65% on mocks, medium if improving but inconsistent, low if insufficient data or declining scores.`,
        });

        return { eligible: true as const, ...object };
      } catch {
        return { eligible: false as const, reason: "ai_error" as const };
      }
    }),
});
