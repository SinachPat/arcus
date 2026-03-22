import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../init";
import {
  QUESTION_REPORT_SUSPENSION_THRESHOLD,
  DIFFICULTY,
  SAA_C03_EXAM_ID,
  SAA_C03_DOMAIN_IDS,
  XP,
} from "@/lib/constants";
import { computeAnswerXP, levelFromXP } from "@/lib/gamification/xp";
import { evaluateBadges } from "@/lib/gamification/badges";
import { calculateStreakUpdate } from "@/lib/gamification/streaks";

export const studyRouter = router({
  // ── Dashboard data ─────────────────────────────────────────────────────
  getDashboardData: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    // Parallel fetch: profile, domain progress, today's sessions, leaderboard snippet
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [profileRes, domainProgressRes, todaySessionsRes, weeklyXpRes] =
      await Promise.all([
        ctx.supabase
          .from("user_profiles")
          .select("*")
          .eq("user_id", userId)
          .single(),
        ctx.supabase
          .from("user_domain_progress")
          .select("domain_id, mastery_percent, questions_answered, questions_correct, last_practiced_at")
          .eq("user_id", userId),
        ctx.supabase
          .from("study_sessions")
          .select("questions_answered, correct_answers, xp_earned, started_at, ended_at")
          .eq("user_id", userId)
          .gte("started_at", todayStart.toISOString()),
        ctx.supabase
          .from("weekly_xp_snapshots")
          .select("xp_earned")
          .eq("user_id", userId)
          .order("week_start", { ascending: false })
          .limit(1),
      ]);

    const profile = profileRes.data as Record<string, unknown> | null;
    const domainProgress = (domainProgressRes.data ?? []) as Array<Record<string, unknown>>;
    const todaySessions = (todaySessionsRes.data ?? []) as Array<Record<string, unknown>>;

    // Calculate today's study minutes
    let todayMinutes = 0;
    let todayQuestions = 0;
    let todayXP = 0;
    for (const s of todaySessions) {
      todayQuestions += (s.questions_answered as number) ?? 0;
      todayXP += (s.xp_earned as number) ?? 0;
      if (s.started_at && s.ended_at) {
        const start = new Date(s.started_at as string).getTime();
        const end = new Date(s.ended_at as string).getTime();
        todayMinutes += Math.round((end - start) / 60000);
      }
    }

    // Find weakest domain for recommendation
    const weakestDomain = domainProgress.length > 0
      ? domainProgress.reduce((weakest, d) =>
          (d.mastery_percent as number) < (weakest.mastery_percent as number) ? d : weakest
        )
      : null;

    // Calculate weighted readiness score
    const domainWeights: Record<string, number> = {
      [SAA_C03_DOMAIN_IDS.RESILIENT]: 30,
      [SAA_C03_DOMAIN_IDS.PERFORMANCE]: 26,
      [SAA_C03_DOMAIN_IDS.SECURITY]: 24,
      [SAA_C03_DOMAIN_IDS.COST]: 10,
      [SAA_C03_DOMAIN_IDS.OPERATIONS]: 6,
      [SAA_C03_DOMAIN_IDS.IMPROVEMENT]: 4,
    };

    let weightedSum = 0;
    let totalWeight = 0;
    for (const dp of domainProgress) {
      const w = domainWeights[dp.domain_id as string] ?? 10;
      weightedSum += (dp.mastery_percent as number) * w;
      totalWeight += w;
    }
    const readinessScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

    return {
      profile: profile
        ? {
            xp: (profile.xp as number) ?? 0,
            level: (profile.level as number) ?? 1,
            currentStreak: (profile.current_streak as number) ?? 0,
            longestStreak: (profile.longest_streak as number) ?? 0,
            streakShields: (profile.streak_shields as number) ?? 0,
            lastStudyDate: (profile.last_study_date as string | null) ?? null,
            dailyGoalMinutes: (profile.daily_goal_minutes as number) ?? 15,
            name: null as string | null, // fetched separately if needed
          }
        : null,
      todayMinutes,
      todayQuestions,
      todayXP,
      readinessScore,
      weeklyXP: (weeklyXpRes.data?.[0] as Record<string, unknown> | undefined)?.xp_earned as number ?? 0,
      weakestDomainId: weakestDomain ? (weakestDomain.domain_id as string) : null,
      domainProgress: domainProgress.map((d) => ({
        domainId: d.domain_id as string,
        masteryPercent: d.mastery_percent as number,
        questionsAnswered: d.questions_answered as number,
        questionsCorrect: d.questions_correct as number,
        lastPracticedAt: d.last_practiced_at as string | null,
      })),
    };
  }),

  // ── Adaptive question selection ────────────────────────────────────────
  getNextQuestions: protectedProcedure
    .input(
      z.object({
        examId: z.string().uuid(),
        count: z.number().int().min(1).max(30).default(10),
        domainId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // 1. Get user's domain progress to find target difficulty
      const { data: progressData } = await ctx.supabase
        .from("user_domain_progress")
        .select("domain_id, current_difficulty, mastery_percent")
        .eq("user_id", userId);

      const progressMap = new Map(
        (progressData ?? []).map((p) => [p.domain_id, p])
      );

      // 2. Get recently answered question IDs (last 3 days) to avoid repeats
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentHistory } = await ctx.supabase
        .from("user_question_history")
        .select("question_id, answered_correctly")
        .eq("user_id", userId)
        .gte("answered_at", threeDaysAgo);

      const recentCorrectIds = new Set(
        (recentHistory ?? [])
          .filter((h) => h.answered_correctly)
          .map((h) => h.question_id)
      );

      // 3. Build query
      let query = ctx.supabase
        .from("questions")
        .select("id, domain_id, subtopic_id, type, content, options, difficulty, explanation, aws_doc_url, exam_objective_code")
        .eq("is_active", true)
        .eq("is_shadow_mode", false);

      if (input.domainId) {
        query = query.eq("domain_id", input.domainId);
      }

      // Fetch extra to filter post-query
      const { data, error } = await query.limit(input.count * 3);
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      // 4. Score and sort questions by relevance
      const scored = (data ?? [])
        .filter((q) => !recentCorrectIds.has(q.id))
        .map((q) => {
          const progress = progressMap.get(q.domain_id);
          const targetDifficulty = progress?.current_difficulty ?? DIFFICULTY.DEFAULT;
          const diffDelta = Math.abs(q.difficulty - targetDifficulty);
          // Lower mastery domains get priority
          const masteryPenalty = progress ? progress.mastery_percent / 100 : 0.5;
          const score = diffDelta + masteryPenalty;
          return { ...q, _score: score };
        })
        .sort((a, b) => a._score - b._score)
        .slice(0, input.count);

      // Fisher-Yates shuffle — unbiased, O(n)
      function shuffle<T>(arr: T[]): T[] {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      }

      // Shuffle question order AND options within each question so the
      // correct answer is never predictably at the same position.
      return shuffle(scored).map((q) => ({
        id: q.id,
        domainId: q.domain_id,
        subtopicId: q.subtopic_id,
        type: q.type,
        content: q.content,
        difficulty: q.difficulty,
        explanation: q.explanation ?? "",
        awsDocUrl: q.aws_doc_url ?? "",
        examObjectiveCode: q.exam_objective_code ?? "",
        // Strip is_correct — practice mode grades server-side
        options: shuffle(
          (q.options as Array<{ id: string; text: string; is_correct: boolean; explanation?: string }>)
            .map(({ id, text }) => ({ id, text }))
        ),
      }));
    }),

  // ── Submit answer with full XP + progress + badges ─────────────────────
  submitAnswer: protectedProcedure
    .input(
      z.object({
        questionId: z.string().uuid(),
        sessionId: z.string().uuid(),
        selectedOptionIds: z.array(z.string()).min(1),
        hintUsed: z.boolean().default(false),
        timeSpentSeconds: z.number().int().nonnegative(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // 1. Fetch question with correct answers
      const { data: question, error: qErr } = await ctx.supabase
        .from("questions")
        .select("id, options, difficulty, domain_id, subtopic_id, explanation, aws_doc_url")
        .eq("id", input.questionId)
        .single();

      if (qErr || !question)
        throw new TRPCError({ code: "NOT_FOUND", message: "Question not found." });

      // 2. Score the answer
      const options = question.options as Array<{ id: string; text: string; is_correct: boolean }>;
      const correctIds = options.filter((o) => o.is_correct).map((o) => o.id);
      const isCorrect =
        correctIds.length === input.selectedOptionIds.length &&
        correctIds.every((id) => input.selectedOptionIds.includes(id));

      // 3. Check if this question was seen before
      const { data: prevHistory } = await ctx.supabase
        .from("user_question_history")
        .select("id")
        .eq("user_id", userId)
        .eq("question_id", input.questionId)
        .limit(1);
      const isRepeat = (prevHistory?.length ?? 0) > 0;

      // 4. Get current domain progress for consecutive tracking
      const { data: domainProgress } = await ctx.supabase
        .from("user_domain_progress")
        .select("*")
        .eq("user_id", userId)
        .eq("domain_id", question.domain_id)
        .single();

      const dp = domainProgress as Record<string, unknown> | null;
      const consecutiveCorrectBefore = (dp?.consecutive_correct as number) ?? 0;

      // 5. Calculate XP
      let xpEarned = 0;
      if (isCorrect) {
        const xpGain = computeAnswerXP({
          difficulty: question.difficulty,
          isFirstAttempt: !isRepeat,
          consecutiveCorrect: consecutiveCorrectBefore,
          isRepeat,
        });
        xpEarned = input.hintUsed ? Math.round(xpGain.total * 0.5) : xpGain.total;
      }

      // 6. Record history
      await ctx.supabase.from("user_question_history").insert({
        user_id: userId,
        question_id: input.questionId,
        session_id: input.sessionId,
        answered_correctly: isCorrect,
        selected_option_ids: input.selectedOptionIds,
        hint_used: input.hintUsed,
        time_spent_seconds: input.timeSpentSeconds,
      });

      // 7. Update domain progress
      const newQuestionsAnswered = ((dp?.questions_answered as number) ?? 0) + 1;
      const newQuestionsCorrect = ((dp?.questions_correct as number) ?? 0) + (isCorrect ? 1 : 0);
      const newMastery = Math.round((newQuestionsCorrect / newQuestionsAnswered) * 100);

      let newConsecutiveCorrect = isCorrect ? consecutiveCorrectBefore + 1 : 0;
      let newConsecutiveIncorrect = isCorrect ? 0 : ((dp?.consecutive_incorrect as number) ?? 0) + 1;
      let newDifficulty = (dp?.current_difficulty as number) ?? DIFFICULTY.DEFAULT;

      if (newConsecutiveCorrect >= DIFFICULTY.STEP_UP_AFTER_CONSECUTIVE_CORRECT) {
        newDifficulty = Math.min(DIFFICULTY.MAX, newDifficulty + 1);
        newConsecutiveCorrect = 0;
      }
      if (newConsecutiveIncorrect >= DIFFICULTY.STEP_DOWN_AFTER_CONSECUTIVE_WRONG) {
        newDifficulty = Math.max(DIFFICULTY.MIN, newDifficulty - 1);
        newConsecutiveIncorrect = 0;
      }

      await ctx.supabase.from("user_domain_progress").upsert(
        {
          user_id: userId,
          domain_id: question.domain_id,
          mastery_percent: newMastery,
          questions_answered: newQuestionsAnswered,
          questions_correct: newQuestionsCorrect,
          current_difficulty: newDifficulty,
          consecutive_correct: newConsecutiveCorrect,
          consecutive_incorrect: newConsecutiveIncorrect,
          last_practiced_at: new Date().toISOString(),
        },
        { onConflict: "user_id,domain_id" }
      );

      // 8. Update user XP + level
      const { data: profile } = await ctx.supabase
        .from("user_profiles")
        .select("xp, level, current_streak, longest_streak, streak_shields, onboarding_completed")
        .eq("user_id", userId)
        .single();

      const currentXP = ((profile as Record<string, unknown> | null)?.xp as number) ?? 0;
      const newTotalXP = currentXP + xpEarned;
      const newLevel = levelFromXP(newTotalXP);
      const oldLevel = ((profile as Record<string, unknown> | null)?.level as number) ?? 1;

      if (xpEarned > 0) {
        await ctx.supabase
          .from("user_profiles")
          .update({ xp: newTotalXP, level: newLevel })
          .eq("user_id", userId);
      }

      // 9. Update session stats (read-then-increment)
      try {
        const { data: sessionRow } = await ctx.supabase
          .from("study_sessions")
          .select("questions_answered, correct_answers, xp_earned")
          .eq("id", input.sessionId)
          .single();
        if (sessionRow) {
          const sr = sessionRow as Record<string, unknown>;
          await ctx.supabase
            .from("study_sessions")
            .update({
              questions_answered: ((sr.questions_answered as number) ?? 0) + 1,
              correct_answers: ((sr.correct_answers as number) ?? 0) + (isCorrect ? 1 : 0),
              xp_earned: ((sr.xp_earned as number) ?? 0) + xpEarned,
            })
            .eq("id", input.sessionId);
        }
      } catch {
        // non-critical — completeSession will finalize
      }

      // 10. Update weekly XP snapshot
      const weekStart = getWeekStart();
      await ctx.supabase.from("weekly_xp_snapshots").upsert(
        {
          user_id: userId,
          week_start: weekStart,
          xp_earned: xpEarned,
          exam_id: SAA_C03_EXAM_ID,
        },
        { onConflict: "user_id,week_start" }
      );

      // 11. Evaluate badges
      let badgesEarned: Array<{ code: string; name: string; xpReward: number }> = [];
      try {
        const [allBadgesRes, earnedBadgesRes, allProgressRes] = await Promise.all([
          ctx.supabase.from("badges").select("*"),
          ctx.supabase.from("user_badges").select("badge_id").eq("user_id", userId),
          ctx.supabase
            .from("user_domain_progress")
            .select("mastery_percent, questions_answered")
            .eq("user_id", userId),
        ]);

        const earnedIds = new Set(
          (earnedBadgesRes.data ?? []).map((b) => (b as Record<string, unknown>).badge_id as string)
        );
        const allProgress = (allProgressRes.data ?? []) as Array<Record<string, unknown>>;
        const totalQuestionsAnswered = allProgress.reduce(
          (sum, p) => sum + ((p.questions_answered as number) ?? 0),
          0
        );
        const highestMastery = allProgress.reduce(
          (max, p) => Math.max(max, (p.mastery_percent as number) ?? 0),
          0
        );

        const p = profile as Record<string, unknown> | null;
        const newBadges = evaluateBadges(
          (allBadgesRes.data ?? []) as import("@/types/database").DbBadge[],
          earnedIds,
          {
            currentStreak: (p?.current_streak as number) ?? 0,
            longestStreak: (p?.longest_streak as number) ?? 0,
            consecutiveCorrect: isCorrect ? consecutiveCorrectBefore + 1 : 0,
            totalQuestionsAnswered,
            onboardingCompleted: (p?.onboarding_completed as boolean) ?? false,
            domainMastery: Object.fromEntries(
              allProgress.map((dp) => [dp.domain_id, dp.mastery_percent as number])
            ),
          }
        );

        // Award new badges
        for (const badge of newBadges) {
          await ctx.supabase
            .from("user_badges")
            .upsert({ user_id: userId, badge_id: badge.badgeId }, { onConflict: "user_id,badge_id" });

          // Award badge XP
          if (badge.xpReward > 0) {
            await ctx.supabase
              .from("user_profiles")
              .update({ xp: newTotalXP + badge.xpReward })
              .eq("user_id", userId);
          }
        }

        badgesEarned = newBadges.map((b) => ({
          code: b.code,
          name: b.name,
          xpReward: b.xpReward,
        }));
      } catch {
        // Badge evaluation is non-critical
      }

      return {
        isCorrect,
        correctOptionIds: correctIds,
        explanation: (question.explanation as string) ?? "",
        awsDocUrl: (question.aws_doc_url as string) ?? "",
        xpEarned,
        newLevel: newLevel > oldLevel ? newLevel : null,
        badgesEarned,
        updatedMastery: newMastery,
      };
    }),

  // ── Start a study session ──────────────────────────────────────────────
  startSession: protectedProcedure
    .input(
      z.object({
        examId: z.string().uuid(),
        type: z.enum(["practice", "mock_exam", "ai_tutor", "diagnostic"]),
        config: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from("study_sessions")
        .insert({
          user_id: ctx.user.id,
          exam_id: input.examId,
          type: input.type,
          questions_answered: 0,
          correct_answers: 0,
          xp_earned: 0,
          config: input.config ?? null,
        })
        .select("id")
        .single();

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { sessionId: (data as Record<string, unknown>).id as string };
    }),

  // ── Complete a session ─────────────────────────────────────────────────
  completeSession: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // 1. Get session data
      const { data: session } = await ctx.supabase
        .from("study_sessions")
        .select("*")
        .eq("id", input.sessionId)
        .eq("user_id", userId)
        .single();

      if (!session)
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found." });

      const s = session as Record<string, unknown>;
      const startedAt = new Date(s.started_at as string);
      const endedAt = new Date();
      const studyMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);

      // 2. Set ended_at
      await ctx.supabase
        .from("study_sessions")
        .update({ ended_at: endedAt.toISOString() })
        .eq("id", input.sessionId);

      // 3. Award session completion XP
      let sessionXP = XP.SESSION_COMPLETE;
      const { data: profileData } = await ctx.supabase
        .from("user_profiles")
        .select("xp, level, current_streak, longest_streak, streak_shields, last_study_date, daily_goal_minutes")
        .eq("user_id", userId)
        .single();

      const p = profileData as Record<string, unknown> | null;
      const currentXP = (p?.xp as number) ?? 0;

      // 4. Check daily goal completion
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data: todaySessions } = await ctx.supabase
        .from("study_sessions")
        .select("started_at, ended_at")
        .eq("user_id", userId)
        .gte("started_at", todayStart.toISOString());

      let totalTodayMinutes = studyMinutes;
      for (const ts of (todaySessions ?? []) as Array<Record<string, unknown>>) {
        if (ts.ended_at && (ts as Record<string, unknown>).started_at) {
          const dur = (new Date(ts.ended_at as string).getTime() - new Date(ts.started_at as string).getTime()) / 60000;
          totalTodayMinutes += Math.round(dur);
        }
      }

      const dailyGoal = (p?.daily_goal_minutes as number) ?? 15;
      const goalMet = totalTodayMinutes >= dailyGoal;
      if (goalMet) sessionXP += XP.DAILY_GOAL_COMPLETE;

      // 5. Update streak
      const streakUpdate = calculateStreakUpdate(
        {
          currentStreak: (p?.current_streak as number) ?? 0,
          longestStreak: (p?.longest_streak as number) ?? 0,
          streakShields: (p?.streak_shields as number) ?? 0,
          lastStudyDate: (p?.last_study_date as string | null) ?? null,
        },
        {
          questionsAnswered: (s.questions_answered as number) ?? 0,
          studyMinutes,
          timezone: "UTC", // TODO: use user's timezone
        }
      );

      // 6. Update profile
      const newXP = currentXP + sessionXP;
      const newLevel = levelFromXP(newXP);

      await ctx.supabase
        .from("user_profiles")
        .update({
          xp: newXP,
          level: newLevel,
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
        questionsAnswered: (s.questions_answered as number) ?? 0,
        correctAnswers: (s.correct_answers as number) ?? 0,
        xpEarned: ((s.xp_earned as number) ?? 0) + sessionXP,
        sessionXP,
        dailyGoalMet: goalMet,
        streakUpdate,
        newLevel,
        studyMinutes,
      };
    }),

  // ── Skill tree (domains + subtopics with progress) ─────────────────────
  getSkillTree: protectedProcedure
    .input(z.object({ examId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [domainsRes, progressRes] = await Promise.all([
        ctx.supabase
          .from("domains")
          .select("*, subtopics(*)")
          .eq("exam_id", input.examId)
          .order("display_order"),
        ctx.supabase
          .from("user_domain_progress")
          .select("domain_id, mastery_percent, questions_answered, questions_correct, current_difficulty, last_practiced_at")
          .eq("user_id", ctx.user.id),
      ]);

      if (domainsRes.error)
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: domainsRes.error.message });

      const progressMap = new Map(
        (progressRes.data ?? []).map((p) => [p.domain_id, p])
      );

      return (domainsRes.data ?? []).map((domain) => {
        const progress = progressMap.get(domain.id);
        return {
          id: domain.id,
          name: domain.name,
          code: domain.code,
          weightPercent: domain.weight_percent,
          displayOrder: domain.display_order,
          mastery: progress?.mastery_percent ?? 0,
          questionsAnswered: progress?.questions_answered ?? 0,
          questionsCorrect: progress?.questions_correct ?? 0,
          currentDifficulty: progress?.current_difficulty ?? DIFFICULTY.DEFAULT,
          lastPracticed: progress?.last_practiced_at ?? null,
          subtopics: ((domain as Record<string, unknown>).subtopics as Array<Record<string, unknown>> ?? []).map((s) => ({
            id: s.id as string,
            name: s.name as string,
            displayOrder: s.display_order as number,
            prerequisiteSubtopicId: s.prerequisite_subtopic_id as string | null,
          })),
        };
      });
    }),

  // ── Domain detail with subtopic progress ───────────────────────────────
  getDomainDetail: protectedProcedure
    .input(z.object({ domainId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const [domainRes, progressRes, subtopicsRes, subtopicProgressRes] =
        await Promise.all([
          ctx.supabase
            .from("domains")
            .select("*")
            .eq("id", input.domainId)
            .single(),
          ctx.supabase
            .from("user_domain_progress")
            .select("*")
            .eq("user_id", userId)
            .eq("domain_id", input.domainId)
            .single(),
          ctx.supabase
            .from("subtopics")
            .select("*")
            .eq("domain_id", input.domainId)
            .order("display_order"),
          ctx.supabase
            .from("user_subtopic_progress")
            .select("*")
            .eq("user_id", userId),
        ]);

      if (domainRes.error || !domainRes.data)
        throw new TRPCError({ code: "NOT_FOUND", message: "Domain not found." });

      const domain = domainRes.data as Record<string, unknown>;
      const progress = progressRes.data as Record<string, unknown> | null;
      const subtopics = (subtopicsRes.data ?? []) as Array<Record<string, unknown>>;
      const subtopicProgress = (subtopicProgressRes.data ?? []) as Array<Record<string, unknown>>;

      const subtopicProgressMap = new Map(
        subtopicProgress.map((sp) => [sp.subtopic_id as string, sp])
      );

      // Get total questions for this domain
      const { count: totalQuestions } = await ctx.supabase
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("domain_id", input.domainId)
        .eq("is_active", true);

      return {
        id: domain.id as string,
        name: domain.name as string,
        code: domain.code as string,
        weightPercent: domain.weight_percent as number,
        mastery: (progress?.mastery_percent as number) ?? 0,
        questionsAnswered: (progress?.questions_answered as number) ?? 0,
        totalQuestions: totalQuestions ?? 0,
        currentDifficulty: (progress?.current_difficulty as number) ?? DIFFICULTY.DEFAULT,
        lastPracticedAt: (progress?.last_practiced_at as string | null) ?? null,
        subtopics: subtopics.map((s) => {
          const sp = subtopicProgressMap.get(s.id as string);
          return {
            id: s.id as string,
            name: s.name as string,
            displayOrder: s.display_order as number,
            prerequisiteSubtopicId: s.prerequisite_subtopic_id as string | null,
            mastery: (sp?.mastery_percent as number) ?? 0,
            questionsAnswered: (sp?.questions_answered as number) ?? 0,
          };
        }),
      };
    }),

  // ── Get domains for study hub ──────────────────────────────────────────
  getDomains: protectedProcedure
    .input(z.object({ examId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from("domains")
        .select("*")
        .eq("exam_id", input.examId)
        .order("display_order");

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data;
    }),

  // ── Recalibrate (placeholder) ──────────────────────────────────────────
  recalibrate: protectedProcedure
    .input(z.object({ examId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      void ctx;
      void input;
      return { sessionId: "placeholder" };
    }),

  // ── Report question ────────────────────────────────────────────────────
  reportQuestion: protectedProcedure
    .input(
      z.object({
        questionId: z.string().uuid(),
        reason: z.enum(["outdated", "incorrect", "unclear"]),
        notes: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.supabase.from("question_reports").insert({
        question_id: input.questionId,
        user_id: ctx.user.id,
        reason: input.reason,
        notes: input.notes,
      });

      const { data: q } = await ctx.supabase
        .from("questions")
        .select("report_count")
        .eq("id", input.questionId)
        .single();

      if (q) {
        const newCount = ((q as Record<string, unknown>).report_count as number ?? 0) + 1;
        await ctx.supabase
          .from("questions")
          .update({
            report_count: newCount,
            ...(newCount >= QUESTION_REPORT_SUSPENSION_THRESHOLD && { is_active: false }),
          })
          .eq("id", input.questionId);
      }

      return { success: true };
    }),
});

// ── Helpers ──────────────────────────────────────────────────────────────

function getWeekStart(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = (day + 6) % 7;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().split("T")[0];
}
