import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../init";
import {
  MOCK_EXAM_MODES,
  MOCK_PASSING_SCORE_PERCENT,
  SAA_C03_DOMAIN_WEIGHTS,
  SAA_C03_EXAM_ID,
  BADGE_CODES,
} from "@/lib/constants";
import { calculateXP, levelFromXP } from "@/lib/gamification/xp";
import { evaluateBadges } from "@/lib/gamification/badges";
import { calculateStreakUpdate } from "@/lib/gamification/streaks";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Today's UTC date as YYYY-MM-DD — leaderboard period key. */
function getWeekStart(): string {
  const now  = new Date();
  const yyyy = now.getUTCFullYear();
  const mm   = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd   = String(now.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Fisher-Yates shuffle — unbiased, O(n). Mutates and returns the array. */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Router ────────────────────────────────────────────────────────────────────

export const mockRouter = router({
  // ── Start a mock exam ──────────────────────────────────────────────────────
  start: protectedProcedure
    .input(
      z.object({
        examId: z.string().uuid(),
        mode: z.enum(["full", "half", "quick"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const config = MOCK_EXAM_MODES[input.mode];

      // 1. Create study session
      const { data: session, error: sErr } = await ctx.supabase
        .from("study_sessions")
        .insert({
          user_id: userId,
          exam_id: input.examId,
          type: "mock_exam",
          questions_answered: 0,
          correct_answers: 0,
          xp_earned: 0,
          config: { mode: input.mode, ...config },
        })
        .select("id")
        .single();

      if (sErr || !session)
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to start session." });

      const sessionId = (session as Record<string, unknown>).id as string;

      // 2. Weighted question selection — one bucket per domain
      const FETCH_MULTIPLIER = 4; // fetch more than needed so shuffle has pool to draw from
      const domainBuckets: Array<Array<Record<string, unknown>>> = [];

      for (const [domainId, weight] of Object.entries(SAA_C03_DOMAIN_WEIGHTS)) {
        const needed = Math.round(config.questionCount * (weight / 100));
        if (needed === 0) continue;

        const { data: rows } = await ctx.supabase
          .from("questions")
          .select("id, domain_id, type, content, options, difficulty")
          .eq("exam_id", input.examId)
          .eq("domain_id", domainId)
          .eq("is_active", true)
          .eq("is_shadow_mode", false)
          .limit(needed * FETCH_MULTIPLIER);

        const shuffled = shuffle((rows ?? []) as Array<Record<string, unknown>>);
        domainBuckets.push(shuffled.slice(0, needed));
      }

      // 3. Interleave buckets round-robin, then Fisher-Yates the final list
      const interleaved: Array<Record<string, unknown>> = [];
      const maxLen = Math.max(...domainBuckets.map((b) => b.length), 0);
      for (let i = 0; i < maxLen; i++) {
        for (const bucket of domainBuckets) {
          if (i < bucket.length) interleaved.push(bucket[i]);
        }
      }

      const final = shuffle(interleaved).slice(0, config.questionCount);

      // 4. Strip is_correct from options before returning
      type RawOption = { id: string; text: string; is_correct: boolean; explanation?: string };
      const questions = final.map((q) => ({
        id: q.id as string,
        domainId: q.domain_id as string,
        type: q.type as string,
        content: q.content as Record<string, unknown>,
        difficulty: q.difficulty as number,
        options: shuffle(
          (q.options as RawOption[]).map(({ id, text }) => ({ id, text }))
        ),
      }));

      return {
        sessionId,
        timeLimitSeconds: config.timeLimitMinutes * 60,
        questions,
      };
    }),

  // ── Submit a completed mock exam ───────────────────────────────────────────
  submit: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        answers: z.array(
          z.object({
            questionId: z.string().uuid(),
            selectedOptionIds: z.array(z.string()),
            flagged: z.boolean(),
          })
        ),
        totalTimeSeconds: z.number().int().nonnegative(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Fetch the session to get config (timeLimitSeconds, mode)
      const { data: sessionRow, error: sessErr } = await ctx.supabase
        .from("study_sessions")
        .select("*")
        .eq("id", input.sessionId)
        .eq("user_id", userId)
        .single();

      if (sessErr || !sessionRow)
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found." });

      const sess = sessionRow as Record<string, unknown>;
      const sessConfig = (sess.config as Record<string, unknown>) ?? {};
      const timeLimitMinutes = (sessConfig.timeLimitMinutes as number) ?? 130;
      const timeLimitSeconds = timeLimitMinutes * 60;
      const mode = (sessConfig.mode as "full" | "half" | "quick") ?? "full";

      // 1. Fetch all questions with correct answers + domain info
      const questionIds = input.answers.map((a) => a.questionId);
      const { data: questionsData, error: qErr } = await ctx.supabase
        .from("questions")
        .select("id, options, domain_id, difficulty")
        .in("id", questionIds);

      if (qErr)
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: qErr.message });

      type QuestionRow = {
        id: string;
        options: Array<{ id: string; is_correct: boolean }>;
        domain_id: string;
        difficulty: number;
      };
      const qMap = new Map(
        ((questionsData ?? []) as QuestionRow[]).map((q) => [q.id, q])
      );

      // Build an answer lookup for quick access
      const answerMap = new Map(input.answers.map((a) => [a.questionId, a]));

      // 2. Score each question
      let correctCount = 0;
      const domainTally: Record<string, { correct: number; total: number }> = {};

      type ScoredAnswer = {
        questionId: string;
        selectedOptionIds: string[];
        flagged: boolean;
        isCorrect: boolean;
        domainId: string;
        difficulty: number;
      };
      const scoredAnswers: ScoredAnswer[] = [];

      for (const [qId, q] of qMap.entries()) {
        const answer = answerMap.get(qId);
        const selected = answer?.selectedOptionIds ?? [];
        const flagged = answer?.flagged ?? false;

        const correctIds = q.options.filter((o) => o.is_correct).map((o) => o.id);
        const isCorrect =
          selected.length > 0 &&
          correctIds.length === selected.length &&
          correctIds.every((id) => selected.includes(id));

        if (isCorrect) correctCount++;

        if (!domainTally[q.domain_id]) domainTally[q.domain_id] = { correct: 0, total: 0 };
        domainTally[q.domain_id].total++;
        if (isCorrect) domainTally[q.domain_id].correct++;

        scoredAnswers.push({
          questionId: qId,
          selectedOptionIds: selected,
          flagged,
          isCorrect,
          domainId: q.domain_id,
          difficulty: q.difficulty,
        });
      }

      const totalCount = scoredAnswers.length;
      const scorePercent = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
      const passed = scorePercent >= MOCK_PASSING_SCORE_PERCENT;

      // 3. Per-domain scores
      const domainResults = Object.entries(domainTally).map(([domainId, r]) => ({
        domainId,
        scorePercent: r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0,
        correct: r.correct,
        total: r.total,
      }));

      // 4. Insert user_question_history for ALL questions
      const historyRows = scoredAnswers.map((a) => ({
        user_id: userId,
        question_id: a.questionId,
        session_id: input.sessionId,
        answered_correctly: a.isCorrect,
        selected_option_ids: a.selectedOptionIds,
        hint_used: false,
        time_spent_seconds: 0,
        flagged: a.flagged,
      }));

      if (historyRows.length > 0) {
        await ctx.supabase.from("user_question_history").insert(historyRows);
      }

      // 5. Bulk upsert user_domain_progress for all domains touched
      const progressUpserts = Object.entries(domainTally).map(([domainId, r]) => ({
        user_id: userId,
        domain_id: domainId,
        mastery_percent: r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0,
        questions_answered: r.total,
        questions_correct: r.correct,
        last_practiced_at: new Date().toISOString(),
      }));

      if (progressUpserts.length > 0) {
        await ctx.supabase
          .from("user_domain_progress")
          .upsert(progressUpserts, { onConflict: "user_id,domain_id" });
      }

      // 6. Award XP
      const xpAwarded = calculateXP({ type: "mock_exam", mockScore: scorePercent });

      // 7. Update user_profiles (xp, level)
      const { data: profileData } = await ctx.supabase
        .from("user_profiles")
        .select("xp, level, current_streak, longest_streak, streak_shields, last_study_date, daily_goal_minutes, onboarding_completed")
        .eq("user_id", userId)
        .single();

      const p = profileData as Record<string, unknown> | null;
      const currentXP = (p?.xp as number) ?? 0;
      const newTotalXP = currentXP + xpAwarded;
      const newLevel = levelFromXP(newTotalXP);

      await ctx.supabase
        .from("user_profiles")
        .update({ xp: newTotalXP, level: newLevel })
        .eq("user_id", userId);

      // 8. Update weekly_xp_snapshots — increment, not replace
      const weekStart = getWeekStart();
      const { data: existingSnap } = await ctx.supabase
        .from("weekly_xp_snapshots")
        .select("xp_earned")
        .eq("user_id", userId)
        .eq("week_start", weekStart)
        .maybeSingle();
      await ctx.supabase.from("weekly_xp_snapshots").upsert(
        {
          user_id:    userId,
          week_start: weekStart,
          xp_earned:  ((existingSnap?.xp_earned as number) ?? 0) + xpAwarded,
          exam_id:    SAA_C03_EXAM_ID,
        },
        { onConflict: "user_id,week_start" }
      );

      // 9. Update study_sessions
      const endedAt = new Date().toISOString();
      await ctx.supabase
        .from("study_sessions")
        .update({
          ended_at: endedAt,
          questions_answered: totalCount,
          correct_answers: correctCount,
          xp_earned: xpAwarded,
        })
        .eq("id", input.sessionId);

      // 10. Evaluate badges
      let badgesEarned: Array<{ code: string; name: string; xpReward: number }> = [];
      try {
        const timeUsedPercent =
          timeLimitSeconds > 0
            ? Math.round((input.totalTimeSeconds / timeLimitSeconds) * 100)
            : 100;

        const [allBadgesRes, earnedBadgesRes, allProgressRes] = await Promise.all([
          ctx.supabase.from("badges").select("*"),
          ctx.supabase.from("user_badges").select("badge_id").eq("user_id", userId),
          ctx.supabase
            .from("user_domain_progress")
            .select("domain_id, mastery_percent, questions_answered")
            .eq("user_id", userId),
        ]);

        const earnedIds = new Set(
          (earnedBadgesRes.data ?? []).map(
            (b) => (b as Record<string, unknown>).badge_id as string
          )
        );
        const allProgress = (allProgressRes.data ?? []) as Array<Record<string, unknown>>;
        const totalQuestionsAnswered = allProgress.reduce(
          (sum, dp) => sum + ((dp.questions_answered as number) ?? 0),
          0
        );
        const highestMastery = allProgress.reduce(
          (max, dp) => Math.max(max, (dp.mastery_percent as number) ?? 0),
          0
        );

        const newBadges = evaluateBadges(
          (allBadgesRes.data ?? []) as import("@/types/database").DbBadge[],
          earnedIds,
          {
            currentStreak: (p?.current_streak as number) ?? 0,
            longestStreak: (p?.longest_streak as number) ?? 0,
            consecutiveCorrect: 0,
            totalQuestionsAnswered,
            onboardingCompleted: (p?.onboarding_completed as boolean) ?? false,
            domainMastery: Object.fromEntries(
              allProgress.map((dp) => [
                dp.domain_id as string,
                (dp.mastery_percent as number) ?? 0,
              ])
            ),
            mockResult: {
              scorePercent,
              passed,
              timeUsedPercent,
              mode,
            },
          }
        );

        // Emit any badge checks that evaluateBadges can't cover via mockResult
        // (PERFECT_SCORE and SPEED_DEMON are handled through mock_exam_score /
        // mock_exam_speed criteria types in the badge rows — no extra logic needed
        // beyond passing mockResult above). Log references to silence linter:
        void BADGE_CODES.PERFECT_SCORE;
        void BADGE_CODES.SPEED_DEMON;
        void BADGE_CODES.THE_ARCHITECT;
        void highestMastery;

        // Award new badges
        let bonusXP = 0;
        for (const badge of newBadges) {
          await ctx.supabase
            .from("user_badges")
            .upsert(
              { user_id: userId, badge_id: badge.badgeId },
              { onConflict: "user_id,badge_id" }
            );
          bonusXP += badge.xpReward;
        }

        if (bonusXP > 0) {
          await ctx.supabase
            .from("user_profiles")
            .update({ xp: newTotalXP + bonusXP })
            .eq("user_id", userId);
        }

        badgesEarned = newBadges.map((b) => ({
          code: b.code,
          name: b.name,
          xpReward: b.xpReward,
        }));
      } catch {
        // Badge evaluation is non-critical
      }

      // 11. Update streak
      const startedAt = new Date(sess.started_at as string);
      const studyMinutes = Math.round(
        (new Date().getTime() - startedAt.getTime()) / 60000
      );

      const streakUpdate = calculateStreakUpdate(
        {
          currentStreak: (p?.current_streak as number) ?? 0,
          longestStreak: (p?.longest_streak as number) ?? 0,
          streakShields: (p?.streak_shields as number) ?? 0,
          lastStudyDate: (p?.last_study_date as string | null) ?? null,
        },
        {
          questionsAnswered: totalCount,
          studyMinutes,
          timezone: "UTC",
        }
      );

      await ctx.supabase
        .from("user_profiles")
        .update({
          current_streak: streakUpdate.newStreak,
          longest_streak: Math.max(
            (p?.longest_streak as number) ?? 0,
            streakUpdate.newStreak
          ),
          streak_shields: streakUpdate.shieldsRemaining,
          last_study_date: new Date().toISOString().split("T")[0],
        })
        .eq("user_id", userId);

      return {
        scorePercent,
        passed,
        correctCount,
        totalCount,
        xpAwarded,
        newLevel,
        domainResults,
        badgesEarned,
        streakUpdate: { newStreak: streakUpdate.newStreak },
      };
    }),

  // ── Get results + review data for a completed mock exam ───────────────────
  getResults: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // 1. Fetch session
      const { data: sessionRow, error: sessErr } = await ctx.supabase
        .from("study_sessions")
        .select("*")
        .eq("id", input.sessionId)
        .eq("user_id", userId)
        .single();

      if (sessErr || !sessionRow)
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found." });

      const sess = sessionRow as Record<string, unknown>;

      // 2. Fetch user_question_history for this session
      const { data: historyRows, error: hErr } = await ctx.supabase
        .from("user_question_history")
        .select("question_id, answered_correctly, selected_option_ids, flagged")
        .eq("session_id", input.sessionId)
        .eq("user_id", userId);

      if (hErr)
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: hErr.message });

      const history = (historyRows ?? []) as Array<Record<string, unknown>>;
      const questionIds = history.map((h) => h.question_id as string);

      // 3. Fetch full question data including options with is_correct + explanation
      const { data: questionsData, error: qErr } = await ctx.supabase
        .from("questions")
        .select("id, content, options, explanation, aws_doc_url, domain_id, difficulty")
        .in("id", questionIds.length > 0 ? questionIds : ["00000000-0000-0000-0000-000000000000"]);

      if (qErr)
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: qErr.message });

      // 4. Fetch domain names
      const domainIds = [
        ...new Set(
          (questionsData ?? []).map((q) => (q as Record<string, unknown>).domain_id as string)
        ),
      ];

      const { data: domainsData } = await ctx.supabase
        .from("domains")
        .select("id, name")
        .in("id", domainIds.length > 0 ? domainIds : ["00000000-0000-0000-0000-000000000000"]);

      const domainNameMap = new Map(
        ((domainsData ?? []) as Array<Record<string, unknown>>).map((d) => [
          d.id as string,
          d.name as string,
        ])
      );

      // 5. Platform average (last 30 days mock exams)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentSessions } = await ctx.supabase
        .from("study_sessions")
        .select("questions_answered, correct_answers")
        .eq("type", "mock_exam")
        .gte("started_at", thirtyDaysAgo)
        .not("ended_at", "is", null);

      const sessions = (recentSessions ?? []) as Array<Record<string, unknown>>;
      let platformAverage = 0;
      if (sessions.length > 0) {
        const sum = sessions.reduce((acc, s) => {
          const qa = (s.questions_answered as number) ?? 0;
          const ca = (s.correct_answers as number) ?? 0;
          return acc + (qa > 0 ? ca / qa : 0);
        }, 0);
        platformAverage = Math.round((sum / sessions.length) * 100);
      }

      // 6. Build per-domain results from session history
      type HistoryRow = {
        question_id: string;
        answered_correctly: boolean;
        selected_option_ids: string[];
        flagged: boolean;
      };
      type QuestionRow = {
        id: string;
        content: Record<string, unknown>;
        options: Array<{ id: string; text: string; is_correct: boolean; explanation?: string }>;
        explanation: string | null;
        aws_doc_url: string | null;
        domain_id: string;
        difficulty: number;
      };

      const historyMap = new Map(
        (history as HistoryRow[]).map((h) => [h.question_id, h])
      );
      const questionsMap = new Map(
        ((questionsData ?? []) as QuestionRow[]).map((q) => [q.id, q])
      );

      const domainTally: Record<string, { correct: number; total: number }> = {};
      const questionResults = Array.from(historyMap.values()).map((h) => {
        const q = questionsMap.get(h.question_id);
        if (!q) return null;

        const domainId = q.domain_id;
        if (!domainTally[domainId]) domainTally[domainId] = { correct: 0, total: 0 };
        domainTally[domainId].total++;
        if (h.answered_correctly) domainTally[domainId].correct++;

        return {
          id: q.id,
          content: q.content,
          options: q.options.map((o) => ({
            id: o.id,
            text: o.text,
            isCorrect: o.is_correct,
            explanation: o.explanation ?? null,
          })),
          explanation: q.explanation ?? "",
          awsDocUrl: q.aws_doc_url ?? "",
          domainId,
          domainName: domainNameMap.get(domainId) ?? "",
          difficulty: q.difficulty,
          userSelectedIds: h.selected_option_ids ?? [],
          isCorrect: h.answered_correctly,
          flagged: h.flagged ?? false,
        };
      }).filter(Boolean);

      const domainResults = Object.entries(domainTally).map(([domainId, r]) => ({
        domainId,
        domainName: domainNameMap.get(domainId) ?? "",
        scorePercent: r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0,
        correct: r.correct,
        total: r.total,
      }));

      return {
        session: {
          id: sess.id as string,
          startedAt: sess.started_at as string,
          endedAt: (sess.ended_at as string | null) ?? null,
          questionsAnswered: (sess.questions_answered as number) ?? 0,
          correctAnswers: (sess.correct_answers as number) ?? 0,
          xpEarned: (sess.xp_earned as number) ?? 0,
          config: sess.config as Record<string, unknown>,
        },
        questions: questionResults,
        domainResults,
        platformAverage,
      };
    }),

  // ── Generate a post-exam study plan ───────────────────────────────────────
  generatePostExamPlan: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // 1. Fetch session + results
      const { data: sessionRow, error: sessErr } = await ctx.supabase
        .from("study_sessions")
        .select("*")
        .eq("id", input.sessionId)
        .eq("user_id", userId)
        .single();

      if (sessErr || !sessionRow)
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found." });

      const sess = sessionRow as Record<string, unknown>;
      const questionsAnswered = (sess.questions_answered as number) ?? 0;
      const correctAnswers = (sess.correct_answers as number) ?? 0;
      const overallScore =
        questionsAnswered > 0 ? Math.round((correctAnswers / questionsAnswered) * 100) : 0;

      // 2. Fetch per-domain progress for this user
      const { data: domainProgressData } = await ctx.supabase
        .from("user_domain_progress")
        .select("domain_id, mastery_percent, questions_answered, questions_correct")
        .eq("user_id", userId);

      const domainProgress = (domainProgressData ?? []) as Array<Record<string, unknown>>;

      // 3. Fetch domain names
      const domainIds = domainProgress.map((d) => d.domain_id as string);
      const { data: domainsData } = await ctx.supabase
        .from("domains")
        .select("id, name, weight_percent")
        .in(
          "id",
          domainIds.length > 0 ? domainIds : ["00000000-0000-0000-0000-000000000000"]
        );

      const domainMap = new Map(
        ((domainsData ?? []) as Array<Record<string, unknown>>).map((d) => [
          d.id as string,
          d,
        ])
      );

      // 4. Identify weak domains (score < passing threshold)
      const WEAK_THRESHOLD = MOCK_PASSING_SCORE_PERCENT;

      type DomainScore = {
        domainId: string;
        domainName: string;
        scorePercent: number;
        weight: number;
      };

      const domainScores: DomainScore[] = domainProgress.map((dp) => {
        const domainId = dp.domain_id as string;
        const domainRow = domainMap.get(domainId);
        const mastery = (dp.mastery_percent as number) ?? 0;
        return {
          domainId,
          domainName: (domainRow?.name as string) ?? domainId,
          scorePercent: mastery,
          weight: (domainRow?.weight_percent as number) ?? 10,
        };
      });

      const weakDomains = domainScores
        .filter((d) => d.scorePercent < WEAK_THRESHOLD)
        .sort((a, b) => {
          // Sort by: lowest score first, break ties by highest weight
          if (a.scorePercent !== b.scorePercent) return a.scorePercent - b.scorePercent;
          return b.weight - a.weight;
        });

      const strongDomains = domainScores.filter((d) => d.scorePercent >= WEAK_THRESHOLD);
      const priorityDomains = weakDomains.map((d) => d.domainId);

      // 5. Build a simple 4-week study plan
      //    Weeks 1-2: focus on weak domains
      //    Week 3:    mixed review with extra time on weakest
      //    Week 4:    full mock + light review

      const weakDomainNames = weakDomains.map((d) => d.domainName);
      const strongDomainNames = strongDomains.map((d) => d.domainName);

      const weeks = [
        {
          week: 1,
          focus: weakDomainNames.slice(0, 3).length > 0
            ? weakDomainNames.slice(0, 3)
            : ["Review all domains"],
          activities: [
            "Complete 20 practice questions per weak domain daily",
            "Read AWS documentation for missed topics",
            "Use AI tutor to clarify concepts where < 60% correct",
          ],
          dailyQuestionTarget: 40,
          estimatedHours: 7,
        },
        {
          week: 2,
          focus: weakDomainNames.length > 3
            ? weakDomainNames.slice(3)
            : weakDomainNames.length > 0
            ? weakDomainNames
            : ["Reinforce weak areas"],
          activities: [
            "Continue targeted practice on weak domains",
            "Review incorrect answers with explanations",
            "Take a half-mode mock exam at end of week",
          ],
          dailyQuestionTarget: 35,
          estimatedHours: 6,
        },
        {
          week: 3,
          focus: strongDomainNames.length > 0
            ? ["Mixed review", ...strongDomainNames.slice(0, 2)]
            : ["Mixed review"],
          activities: [
            "Mixed-domain practice sessions to maintain strong areas",
            "Re-attempt previously failed questions",
            "Scenario-based practice for cross-domain questions",
          ],
          dailyQuestionTarget: 30,
          estimatedHours: 5,
        },
        {
          week: 4,
          focus: ["Full exam simulation", "Light review"],
          activities: [
            "Take two full-mode mock exams",
            "Review only flagged and incorrect questions",
            "Rest 1 day before the real exam",
          ],
          dailyQuestionTarget: 25,
          estimatedHours: 5,
        },
      ];

      // 6. Estimate days to readiness
      //    Simple heuristic: each weak domain needs ~3 days of focused study
      const daysForWeakDomains = weakDomains.length * 3;
      const baselineGap = Math.max(0, WEAK_THRESHOLD - overallScore);
      const extraDays = Math.round(baselineGap / 5); // ~5 pts per day of practice
      const estimatedDaysToReadiness = Math.min(
        28,
        Math.max(7, daysForWeakDomains + extraDays)
      );

      // 7. Upsert into study_plans (mark previous as inactive)
      const planData = {
        weeks,
        priorityDomains,
        estimatedDaysToReadiness,
        generatedFromSessionId: input.sessionId,
        overallScore,
        weakDomains: weakDomains.map((d) => ({ domainId: d.domainId, scorePercent: d.scorePercent })),
      };

      // Deactivate existing active plans for this user
      await ctx.supabase
        .from("study_plans")
        .update({ is_active: false })
        .eq("user_id", userId)
        .eq("is_active", true);

      // Insert new plan
      await ctx.supabase.from("study_plans").insert({
        user_id: userId,
        exam_id: SAA_C03_EXAM_ID,
        is_active: true,
        plan_data: planData,
        source_session_id: input.sessionId,
      });

      return {
        weeks,
        priorityDomains,
        estimatedDaysToReadiness,
      };
    }),
});
