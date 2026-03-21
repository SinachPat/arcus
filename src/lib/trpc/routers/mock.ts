import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../init";
import { MOCK_EXAM_MODES, MOCK_PASSING_SCORE_PERCENT, SAA_C03_DOMAIN_WEIGHTS } from "@/lib/constants";

const MockMode = z.enum(["full", "half", "quick"]);

export const mockRouter = router({
  /** Start a mock exam session and get questions. */
  start: protectedProcedure
    .input(
      z.object({
        examId: z.string().uuid(),
        mode:   MockMode,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const config = MOCK_EXAM_MODES[input.mode];

      // Create study session record
      const { data: session, error: sErr } = await ctx.supabase
        .from("study_sessions")
        .insert({
          user_id:  ctx.user.id,
          exam_id:  input.examId,
          type:     "mock_exam",
          config:   { mode: input.mode, ...config },
        })
        .select("id")
        .single();

      if (sErr || !session) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to start session." });

      // TODO: select questions weighted by SAA_C03_DOMAIN_WEIGHTS
      // For now: fetch random questions
      const { data: questions, error: qErr } = await ctx.supabase
        .from("questions")
        .select("id, domain_id, type, content, options, difficulty")
        .eq("is_active", true)
        .limit(config.questionCount);

      if (qErr) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: qErr.message });

      return {
        sessionId:         session.id,
        timeLimitSeconds:  config.timeLimitMinutes * 60,
        questions: (questions ?? []).map((q) => ({
          ...q,
          options: (q.options as Array<{ id: string; text: string; is_correct: boolean; explanation: string }>)
            .map(({ id, text }) => ({ id, text })),
          flagged: false,
        })),
      };
    }),

  /** Submit the completed mock exam and compute results. */
  submit: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        answers: z.array(
          z.object({
            questionId:        z.string().uuid(),
            selectedOptionIds: z.array(z.string()),
            timeSpentSeconds:  z.number().int().nonnegative(),
            flagged:           z.boolean(),
          })
        ),
        totalTimeSeconds: z.number().int().nonnegative(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Fetch all questions with correct answers
      const questionIds = input.answers.map((a) => a.questionId);
      const { data: questions, error: qErr } = await ctx.supabase
        .from("questions")
        .select("id, options, domain_id, difficulty")
        .in("id", questionIds);

      if (qErr) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: qErr.message });

      // 2. Score each answer
      const qMap = new Map((questions ?? []).map((q) => [q.id, q]));
      let correct = 0;
      const domainResults: Record<string, { correct: number; total: number }> = {};

      for (const answer of input.answers) {
        const q = qMap.get(answer.questionId);
        if (!q) continue;

        const options = q.options as Array<{ id: string; is_correct: boolean }>;
        const correctIds = options.filter((o) => o.is_correct).map((o) => o.id);
        const isCorrect =
          correctIds.length === answer.selectedOptionIds.length &&
          correctIds.every((id) => answer.selectedOptionIds.includes(id));

        if (isCorrect) correct++;

        if (!domainResults[q.domain_id]) domainResults[q.domain_id] = { correct: 0, total: 0 };
        domainResults[q.domain_id].total++;
        if (isCorrect) domainResults[q.domain_id].correct++;
      }

      const total        = input.answers.length;
      const scorePercent = Math.round((correct / total) * 100);
      const passed       = scorePercent >= MOCK_PASSING_SCORE_PERCENT;

      // 3. Close session
      await ctx.supabase
        .from("study_sessions")
        .update({
          ended_at:          new Date().toISOString(),
          questions_answered: total,
          correct_answers:   correct,
          xp_earned:         0, // TODO: calculate XP
        })
        .eq("id", input.sessionId);

      // TODO: award XP via gamification layer
      // TODO: trigger post-exam study plan via ToolLoopAgent
      // TODO: update user_domain_progress for all answered domains

      return {
        sessionId:     input.sessionId,
        scorePercent,
        passed,
        correctCount:  correct,
        totalCount:    total,
        domainResults: Object.entries(domainResults).map(([domainId, r]) => ({
          domainId,
          scorePercent: Math.round((r.correct / r.total) * 100),
          correct:      r.correct,
          total:        r.total,
        })),
      };
    }),

  /** Get results and review data for a completed mock exam. */
  getResults: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data: session, error } = await ctx.supabase
        .from("study_sessions")
        .select("*")
        .eq("id", input.sessionId)
        .eq("user_id", ctx.user.id)
        .single();

      if (error || !session) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found." });
      return session;
    }),
});

// Silence unused import until weighted selection is implemented
void SAA_C03_DOMAIN_WEIGHTS;
