import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { generateObject } from "ai";
import { router, protectedProcedure } from "../init";
import { anthropic } from "@/lib/ai/index";
import {
  DIAGNOSTIC_QUESTION_COUNT,
  DIAGNOSTIC_MIN_PER_DOMAIN,
  AI_MODELS,
  XP,
  BADGE_CODES,
  SAA_C03_DOMAIN_IDS,
  SAA_C03_DOMAIN_WEIGHTS,
} from "@/lib/constants";

// ---- Zod schemas ----

const DiagnosticAnswerSchema = z.object({
  questionId:        z.string().uuid(),
  selectedOptionIds: z.array(z.string()),
  correct:           z.boolean(),
  difficulty:        z.number().int().min(1).max(5),
  domainId:          z.string().uuid(),
  timeSpentSeconds:  z.number().int().nonnegative().optional(),
});

const StudyPlanSchema = z.object({
  estimatedDaysToReadiness: z.number(),
  weeklyPlan: z.array(
    z.object({
      weekNumber:   z.number(),
      focusDomains: z.array(z.string()),
      dailyMinutes: z.number(),
      goals:        z.array(z.string()).max(3),
    })
  ),
  priorityDomains: z.array(z.string()),
});

export const onboardingRouter = router({
  /** Get the currently active exam catalog. */
  getExams: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("exams")
      .select("*")
      .eq("is_active", true)
      .order("created_at");

    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return data ?? [];
  }),

  /**
   * Fetch diagnostic questions for a given exam.
   *
   * Returns full option data INCLUDING is_correct — intentional for the
   * diagnostic flow which needs instant client-side feedback. Practice/mock
   * endpoints strip this field and verify server-side.
   */
  getQuestions: protectedProcedure
    .input(z.object({ examId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Fetch domains for this exam to ensure coverage
      const { data: domains } = await ctx.supabase
        .from("domains")
        .select("id")
        .eq("exam_id", input.examId);

      const domainIds = (domains ?? []).map((d: { id: string }) => d.id);

      // Strategy: fetch min questions per domain first, then fill remaining
      const allQuestions: Array<Record<string, unknown>> = [];
      const usedIds = new Set<string>();

      // Phase 1: ensure minimum coverage per domain
      for (const domainId of domainIds) {
        const { data } = await ctx.supabase
          .from("questions")
          .select("id, domain_id, subtopic_id, type, content, options, difficulty")
          .eq("domain_id", domainId)
          .eq("is_active", true)
          .eq("is_sme_verified", true)
          .eq("is_shadow_mode", false)
          .limit(DIAGNOSTIC_MIN_PER_DOMAIN);

        for (const q of data ?? []) {
          if (!usedIds.has(q.id as string)) {
            allQuestions.push(q);
            usedIds.add(q.id as string);
          }
        }
      }

      // Phase 2: fill remaining slots
      const remaining = DIAGNOSTIC_QUESTION_COUNT - allQuestions.length;
      if (remaining > 0) {
        const { data } = await ctx.supabase
          .from("questions")
          .select("id, domain_id, subtopic_id, type, content, options, difficulty")
          .eq("is_active", true)
          .eq("is_sme_verified", true)
          .eq("is_shadow_mode", false)
          .limit(remaining + usedIds.size); // fetch extra to filter used

        for (const q of data ?? []) {
          if (allQuestions.length >= DIAGNOSTIC_QUESTION_COUNT) break;
          if (!usedIds.has(q.id as string)) {
            allQuestions.push(q);
            usedIds.add(q.id as string);
          }
        }
      }

      // Shuffle for variety
      const shuffled = allQuestions.sort(() => Math.random() - 0.5);

      return shuffled.map((q) => ({
        id:         q.id as string,
        domainId:   q.domain_id as string,
        subtopicId: q.subtopic_id as string | null,
        type:       q.type as string,
        content:    q.content as string,
        difficulty: q.difficulty as number,
        options:    (q.options as Array<{ id: string; text: string; is_correct: boolean }>).map(
          (opt) => ({ id: opt.id, text: opt.text, isCorrect: opt.is_correct })
        ),
      }));
    }),

  /**
   * Submit diagnostic answers and compute readiness score.
   *
   * Readiness = weighted accuracy * difficulty factor, scaled 0–100.
   * Weighted accuracy uses SAA-C03 domain weights so higher-weight
   * domains contribute more to the overall score.
   */
  submitDiagnostic: protectedProcedure
    .input(
      z.object({
        examId:  z.string().uuid(),
        answers: z.array(DiagnosticAnswerSchema),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // ---- 1. Per-domain accuracy ----
      const domainGroups: Record<string, { correct: number; total: number }> = {};
      for (const answer of input.answers) {
        if (!domainGroups[answer.domainId]) {
          domainGroups[answer.domainId] = { correct: 0, total: 0 };
        }
        domainGroups[answer.domainId].total++;
        if (answer.correct) domainGroups[answer.domainId].correct++;
      }

      const domainScores: Record<string, number> = {};
      for (const [domainId, counts] of Object.entries(domainGroups)) {
        domainScores[domainId] = Math.round((counts.correct / counts.total) * 100);
      }

      // ---- 2. Weighted readiness score ----
      let weightedSum = 0;
      let totalWeight = 0;
      for (const [domainId, score] of Object.entries(domainScores)) {
        const weight = SAA_C03_DOMAIN_WEIGHTS[domainId] ?? 10; // fallback weight
        weightedSum += score * weight;
        totalWeight += weight;
      }
      const weightedAccuracy = totalWeight > 0 ? weightedSum / totalWeight : 0;

      // Difficulty factor: average difficulty / 3, capped at [0.8, 1.4]
      const avgDifficulty =
        input.answers.reduce((s, a) => s + a.difficulty, 0) / input.answers.length;
      const difficultyFactor = Math.min(1.4, Math.max(0.8, avgDifficulty / 3));

      const readinessScore = Math.round(
        Math.min(100, weightedAccuracy * difficultyFactor)
      );

      // ---- 3. Upsert user_domain_progress ----
      for (const [domainId, counts] of Object.entries(domainGroups)) {
        const { error } = await ctx.supabase.from("user_domain_progress").upsert(
          {
            user_id:                userId,
            domain_id:              domainId,
            mastery_percent:        domainScores[domainId],
            questions_answered:     counts.total,
            questions_correct:      counts.correct,
            current_difficulty:     3,
            consecutive_correct:    0,
            consecutive_incorrect:  0,
          },
          { onConflict: "user_id,domain_id" }
        );
        if (error) console.error("Failed to upsert domain progress:", error.message);
      }

      // ---- 4. Create study session ----
      const totalCorrect = input.answers.filter((a) => a.correct).length;
      const xpEarned = totalCorrect * XP.CORRECT_ANSWER_BASE;

      const { data: session, error: sessionError } = await ctx.supabase
        .from("study_sessions")
        .insert({
          user_id:            userId,
          exam_id:            input.examId,
          type:               "diagnostic",
          questions_answered: input.answers.length,
          correct_answers:    totalCorrect,
          xp_earned:          xpEarned,
        })
        .select("id")
        .single();

      if (sessionError) console.error("Failed to create session:", sessionError.message);

      // ---- 5. Award diagnostic XP ----
      const { data: profile } = await ctx.supabase
        .from("user_profiles")
        .select("xp")
        .eq("user_id", userId)
        .single();

      if (profile) {
        await ctx.supabase
          .from("user_profiles")
          .update({ xp: (profile.xp ?? 0) + xpEarned })
          .eq("user_id", userId);
      }

      return {
        readinessScore,
        domainScores,
        sessionId: session?.id ?? null,
        xpEarned,
      };
    }),

  /**
   * Generate a personalized study plan using Claude via generateObject.
   * Stores the result in study_plans and returns the structured plan.
   */
  generateStudyPlan: protectedProcedure
    .input(
      z.object({
        examId:          z.string().uuid(),
        domainScores:    z.record(z.string(), z.number()),
        targetTimeframe: z.string().optional(),
        hoursPerWeek:    z.number().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch domain names for richer prompting
      const { data: domains } = await ctx.supabase
        .from("domains")
        .select("id, name, weight_percent")
        .eq("exam_id", input.examId)
        .order("display_order");

      const domainInfo = (domains ?? [])
        .map((d: { id: string; name: string; weight_percent: number }) => {
          const score = input.domainScores[d.id] ?? 0;
          return `${d.name} (weight: ${d.weight_percent}%, score: ${score}%)`;
        })
        .join("\n");

      const prompt = `You are building a personalized AWS SAA-C03 study plan.
The student has these domain scores:
${domainInfo}

Their target exam is ${input.targetTimeframe ?? "not set (assume 8 weeks)"}.
They can study ${input.hoursPerWeek} hours per week.

The exam domains are weighted: Resilient 30%, High-Performing 26%, Secure 24%, Cost-Optimized 10%, Operational 6%, Continuous 4%.

Create a week-by-week study plan that prioritizes weakest domains while maintaining coverage. Keep goals concise and actionable. Each week should have at most 3 goals.`;

      try {
        const { object: plan } = await generateObject({
          model: anthropic(AI_MODELS.studyPlan),
          schema: StudyPlanSchema,
          prompt,
        });

        // Store in study_plans table
        const { error: insertError } = await ctx.supabase.from("study_plans").insert({
          user_id:   ctx.user.id,
          exam_id:   input.examId,
          weeks:     plan.weeklyPlan.map((w) => ({
            week:          w.weekNumber,
            focus_domains: w.focusDomains,
            daily_minutes: w.dailyMinutes,
            goals:         w.goals,
          })),
          is_active:                      true,
          readiness_score_at_generation:  Object.values(input.domainScores).reduce((a, b) => a + b, 0) /
                                          Math.max(1, Object.keys(input.domainScores).length),
        });

        if (insertError) console.error("Failed to save study plan:", insertError.message);

        return plan;
      } catch (err) {
        console.error("AI study plan generation failed, using fallback:", err);

        // Fallback plan
        const weeklyHours = input.hoursPerWeek;
        const dailyMinutes = Math.round((weeklyHours * 60) / 7);
        const weakDomains = Object.entries(input.domainScores)
          .sort(([, a], [, b]) => a - b)
          .slice(0, 3)
          .map(([id]) => {
            const domain = (domains ?? []).find((d: { id: string }) => d.id === id);
            return (domain as { name?: string } | undefined)?.name ?? id;
          });

        return {
          estimatedDaysToReadiness: 56,
          weeklyPlan: Array.from({ length: 8 }, (_, i) => ({
            weekNumber:   i + 1,
            focusDomains: weakDomains,
            dailyMinutes,
            goals: [
              `Complete ${Math.round(dailyMinutes / 3)} practice questions`,
              "Review incorrect answers with AI tutor",
              "Focus on high-weight domains",
            ],
          })),
          priorityDomains: weakDomains,
        };
      }
    }),

  /**
   * Mark onboarding as complete.
   * Sets daily goal, awards "First Steps" badge (50 XP),
   * and ensures user_domain_progress rows exist for all domains.
   */
  completeOnboarding: protectedProcedure
    .input(z.object({ dailyGoalMinutes: z.number().int().min(5).max(120) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // 1. Update profile
      const { error: profileError } = await ctx.supabase
        .from("user_profiles")
        .update({
          onboarding_completed: true,
          daily_goal_minutes:   input.dailyGoalMinutes,
        })
        .eq("user_id", userId);

      if (profileError) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: profileError.message });
      }

      // 2. Award "First Steps" badge
      let xpAwarded = 0;
      const { data: badge } = await ctx.supabase
        .from("badges")
        .select("id, xp_reward")
        .eq("code", BADGE_CODES.FIRST_STEPS)
        .single();

      if (badge) {
        // Insert badge (ignore duplicate)
        await ctx.supabase.from("user_badges").upsert(
          { user_id: userId, badge_id: badge.id },
          { onConflict: "user_id,badge_id" }
        );

        // Award badge XP
        xpAwarded = badge.xp_reward ?? 50;
        const { data: profile } = await ctx.supabase
          .from("user_profiles")
          .select("xp")
          .eq("user_id", userId)
          .single();

        await ctx.supabase
          .from("user_profiles")
          .update({ xp: ((profile as { xp?: number } | null)?.xp ?? 0) + xpAwarded })
          .eq("user_id", userId);
      }

      // 3. Ensure domain progress rows exist for all 6 domains
      const domainIds = Object.values(SAA_C03_DOMAIN_IDS);
      for (const domainId of domainIds) {
        await ctx.supabase.from("user_domain_progress").upsert(
          {
            user_id:               userId,
            domain_id:             domainId,
            mastery_percent:       0,
            questions_answered:    0,
            questions_correct:     0,
            current_difficulty:    3,
            consecutive_correct:   0,
            consecutive_incorrect: 0,
          },
          { onConflict: "user_id,domain_id" }
        );
      }

      return { success: true, xpAwarded };
    }),
});
