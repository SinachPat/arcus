import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../router";
import { DIAGNOSTIC_QUESTION_COUNT } from "@/lib/constants";

const DiagnosticAnswerSchema = z.object({
  questionId:        z.string().uuid(),
  selectedOptionIds: z.array(z.string()),
  timeSpentSeconds:  z.number().int().nonnegative(),
});

const SelfAssessmentSchema = z.object({
  experienceLevel:    z.enum(["beginner", "intermediate", "advanced"]),
  productionUsage:    z.boolean(),
  priorAttempts:      z.number().int().min(0),
  targetExamDate:     z.string().optional(), // ISO date string
  studyHoursPerWeek:  z.number().int().min(1).max(40),
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
    return data;
  }),

  /** Select an exam and save the self-assessment answers. */
  selectExam: protectedProcedure
    .input(
      z.object({
        examId:         z.string().uuid(),
        selfAssessment: SelfAssessmentSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from("user_profiles")
        .update({ current_exam_id: input.examId })
        .eq("user_id", ctx.user.id);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      // TODO: store self-assessment in a user_onboarding_data table or JSONB field
      return { success: true };
    }),

  /** Fetch the diagnostic questions for a given exam. */
  getDiagnosticQuestions: protectedProcedure
    .input(z.object({ examId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // TODO: implement adaptive question selection across all domains
      // Ensure min 2 questions per domain (DIAGNOSTIC_MIN_PER_DOMAIN)
      const { data, error } = await ctx.supabase
        .from("questions")
        .select("id, domain_id, subtopic_id, type, content, options, difficulty")
        .eq("is_active", true)
        .limit(DIAGNOSTIC_QUESTION_COUNT);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      // Strip is_correct from options before sending to client
      return data.map((q) => ({
        ...q,
        options: (q.options as Array<{ id: string; text: string; is_correct: boolean; explanation: string }>)
          .map(({ id, text }) => ({ id, text })),
      }));
    }),

  /** Submit diagnostic answers and generate readiness score. */
  submitDiagnostic: protectedProcedure
    .input(
      z.object({
        examId:  z.string().uuid(),
        answers: z.array(DiagnosticAnswerSchema),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // TODO: score answers, compute per-domain accuracy, calculate readiness score (0–100)
      // TODO: create/update user_domain_progress rows
      // TODO: call generateStudyPlan agent
      void ctx; void input;
      return {
        readinessScore:  45, // placeholder
        domainScores:    {} as Record<string, number>,
        estimatedDays:   60,
      };
    }),

  /** Trigger ToolLoopAgent to generate a week-by-week study plan. */
  generateStudyPlan: protectedProcedure
    .input(
      z.object({
        examId:          z.string().uuid(),
        targetExamDate:  z.string().optional(),
        studyHoursPerWeek: z.number().int().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // TODO: call src/lib/ai/study-plan.ts generateStudyPlan()
      // Store result in study_plans table
      void ctx; void input;
      return { planId: "placeholder" };
    }),

  /** Mark onboarding as complete. */
  complete: protectedProcedure.mutation(async ({ ctx }) => {
    const { error } = await ctx.supabase
      .from("user_profiles")
      .update({ onboarding_completed: true })
      .eq("user_id", ctx.user.id);

    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return { success: true };
  }),
});
