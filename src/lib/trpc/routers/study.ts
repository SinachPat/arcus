import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../router";
import { QUESTION_REPORT_SUSPENSION_THRESHOLD, DIFFICULTY } from "@/lib/constants";

export const studyRouter = router({
  /** Adaptive question selection for a study session. */
  getNextQuestions: protectedProcedure
    .input(
      z.object({
        examId:    z.string().uuid(),
        count:     z.number().int().min(1).max(30).default(10),
        domainId:  z.string().uuid().optional(), // force a specific domain
      })
    )
    .query(async ({ ctx, input }) => {
      // TODO: implement full adaptive selection algorithm:
      //   1. Fetch user_domain_progress to find weakest domains
      //   2. Apply spaced repetition intervals
      //   3. Target difficulty ±1 from current_difficulty
      //   4. Avoid repeating questions seen in the last 30 days
      //   5. Enforce variety: no same domain 3 sessions in a row
      const { data, error } = await ctx.supabase
        .from("questions")
        .select("id, domain_id, subtopic_id, type, content, options, difficulty, exam_objective_code")
        .eq("is_active", true)
        .limit(input.count);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data.map((q) => ({
        ...q,
        options: (q.options as Array<{ id: string; text: string; is_correct: boolean; explanation: string }>)
          .map(({ id, text }) => ({ id, text })),
      }));
    }),

  /** Submit a single answer; award XP and update mastery server-side. */
  submitAnswer: protectedProcedure
    .input(
      z.object({
        questionId:        z.string().uuid(),
        sessionId:         z.string().uuid(),
        selectedOptionIds: z.array(z.string()).min(1),
        hintUsed:          z.boolean().default(false),
        timeSpentSeconds:  z.number().int().nonnegative(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Fetch question with correct answers
      const { data: question, error: qErr } = await ctx.supabase
        .from("questions")
        .select("id, options, difficulty, domain_id, subtopic_id")
        .eq("id", input.questionId)
        .single();

      if (qErr || !question) throw new TRPCError({ code: "NOT_FOUND", message: "Question not found." });

      // 2. Score the answer
      const options = question.options as Array<{ id: string; is_correct: boolean }>;
      const correctIds = options.filter((o) => o.is_correct).map((o) => o.id);
      const isCorrect =
        correctIds.length === input.selectedOptionIds.length &&
        correctIds.every((id) => input.selectedOptionIds.includes(id));

      // TODO: calculate XP using src/lib/gamification/xp.ts
      // TODO: update user_domain_progress, user_subtopic_progress
      // TODO: update weekly_xp_snapshots
      // TODO: evaluate badges via src/lib/gamification/badges.ts

      // 3. Record history
      await ctx.supabase.from("user_question_history").insert({
        user_id:           ctx.user.id,
        question_id:       input.questionId,
        session_id:        input.sessionId,
        answered_correctly: isCorrect,
        selected_option_ids: input.selectedOptionIds,
        hint_used:         input.hintUsed,
        time_spent_seconds: input.timeSpentSeconds,
      });

      return {
        isCorrect,
        correctOptionIds: correctIds,
        xpEarned:         0, // TODO
        newBadges:        [] as string[],
      };
    }),

  /** Get the skill tree for the current exam. */
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
          .select("domain_id, mastery_percent, last_practiced_at")
          .eq("user_id", ctx.user.id),
      ]);

      if (domainsRes.error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: domainsRes.error.message });

      const progressMap = new Map(
        (progressRes.data ?? []).map((p) => [p.domain_id, p])
      );

      return (domainsRes.data ?? []).map((domain) => ({
        ...domain,
        mastery: progressMap.get(domain.id)?.mastery_percent ?? 0,
        lastPracticed: progressMap.get(domain.id)?.last_practiced_at ?? null,
      }));
    }),

  /** 10-question recalibration diagnostic. */
  recalibrate: protectedProcedure
    .input(z.object({ examId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // TODO: same as onboarding diagnostic but 10 questions
      // TODO: re-run study plan generation after scoring
      void ctx; void input;
      return { sessionId: "placeholder" };
    }),

  /** Report a question as outdated, incorrect, or unclear. */
  reportQuestion: protectedProcedure
    .input(
      z.object({
        questionId: z.string().uuid(),
        reason:     z.enum(["outdated", "incorrect", "unclear"]),
        notes:      z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Insert report
      await ctx.supabase.from("question_reports").insert({
        question_id: input.questionId,
        user_id:     ctx.user.id,
        reason:      input.reason,
        notes:       input.notes,
      });

      // Increment report_count; auto-suspend at threshold
      const { data: q } = await ctx.supabase
        .from("questions")
        .select("report_count")
        .eq("id", input.questionId)
        .single();

      if (q) {
        const newCount = (q.report_count ?? 0) + 1;
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

  /** Get domains for an exam (for study hub). */
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
});

// Silence unused import warning until TODO implementations land
void DIFFICULTY;
