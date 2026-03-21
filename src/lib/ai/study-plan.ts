import { generateText, generateObject, tool, stepCountIs } from "ai";
import { z } from "zod";
import { anthropic } from "./index";
import { AI_MODELS } from "@/lib/constants";
import type { GeneratedStudyPlan } from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const STUDY_PLAN_SYSTEM = `You are an expert AWS certification coach building a personalized study plan.
Use the available tools to gather user performance data, identify knowledge gaps, and understand scheduling constraints.
Then generate a structured, week-by-week study plan that:
- Focuses the most time on high-weight, low-mastery domains
- Applies spaced repetition: revisit weak areas every 3–7 days
- Is realistic given the user's daily goal and target date
- Gives each week 3–5 specific, actionable goals
Output a concrete JSON study plan — do not ask the user questions.`;

interface GenerateStudyPlanParams {
  userId:           string;
  examId:           string;
  targetExamDate:   string | null; // ISO date
  dailyGoalMinutes: number;
  supabase:         SupabaseClient<Database>;
}

/**
 * ToolLoopAgent: uses generateText with maxSteps to iteratively
 * fetch context via tools, then outputs a structured study plan.
 */
export async function generateStudyPlan(params: GenerateStudyPlanParams): Promise<GeneratedStudyPlan> {
  const { userId, examId, targetExamDate, dailyGoalMinutes, supabase } = params;

  // Tool closures capture supabase + params
  const { text } = await generateText({
    model: anthropic(AI_MODELS.studyPlan),
    system: STUDY_PLAN_SYSTEM,
    prompt: `Generate a personalized study plan for user ${userId} preparing for exam ${examId}.
Target date: ${targetExamDate ?? "not set — assume 8 weeks"}.
Daily study goal: ${dailyGoalMinutes} minutes.
Use the tools to fetch their performance data, then output the complete study plan as JSON.`,
    stopWhen: stepCountIs(10),
    tools: {
      /** Fetch user's current domain mastery percentages. */
      get_domain_mastery: tool({
        description: "Fetch the user's current mastery percentage for each exam domain",
        inputSchema: z.object({}),
        execute: async () => {
          const { data } = await supabase
            .from("user_domain_progress")
            .select("domain_id, mastery_percent, questions_answered, consecutive_incorrect")
            .eq("user_id", userId);
          return { domains: data ?? [] };
        },
      }),

      /** Fetch recently answered questions to identify weak subtopics. */
      get_weak_subtopics: tool({
        description: "Identify subtopics where the user is struggling (low mastery or high error rate)",
        inputSchema: z.object({
          limit: z.number().int().min(1).max(20).default(10),
        }),
        execute: async ({ limit }) => {
          const { data } = await supabase
            .from("user_subtopic_progress")
            .select("subtopic_id, mastery_percent, questions_answered")
            .eq("user_id", userId)
            .lt("mastery_percent", 60)
            .order("mastery_percent", { ascending: true })
            .limit(limit);
          return { weakSubtopics: data ?? [] };
        },
      }),

      /** Fetch domain metadata (names, weights) for the target exam. */
      get_exam_domains: tool({
        description: "Fetch domain names and exam weight percentages for the target exam",
        inputSchema: z.object({}),
        execute: async () => {
          const { data } = await supabase
            .from("domains")
            .select("id, name, code, weight_percent, display_order")
            .eq("exam_id", examId)
            .order("display_order");
          return { domains: data ?? [] };
        },
      }),

      /** Fetch recent study session stats (accuracy, time spent). */
      get_recent_performance: tool({
        description: "Fetch accuracy and study time from the last 14 days of sessions",
        inputSchema: z.object({}),
        execute: async () => {
          const since = new Date();
          since.setDate(since.getDate() - 14);

          const { data } = await supabase
            .from("study_sessions")
            .select("started_at, ended_at, questions_answered, correct_answers, type")
            .eq("user_id", userId)
            .eq("exam_id", examId)
            .gte("started_at", since.toISOString())
            .order("started_at", { ascending: false });

          const sessions = data ?? [];
          const totalQ   = sessions.reduce((s, r) => s + (r.questions_answered ?? 0), 0);
          const totalC   = sessions.reduce((s, r) => s + (r.correct_answers ?? 0), 0);
          const minutes  = sessions.reduce((s, r) => {
            if (!r.ended_at) return s;
            return s + (new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 60000;
          }, 0);

          return {
            recentSessions:   sessions.length,
            totalQuestions:   totalQ,
            overallAccuracy:  totalQ > 0 ? Math.round((totalC / totalQ) * 100) : 0,
            totalMinutes:     Math.round(minutes),
          };
        },
      }),
    },
  });

  // Parse the JSON study plan from the model's final text output
  return parseStudyPlanFromText(text, targetExamDate, dailyGoalMinutes);
}

/** Extract and validate the JSON study plan from the model's text output. */
function parseStudyPlanFromText(
  text:             string,
  targetExamDate:   string | null,
  dailyGoalMinutes: number,
): GeneratedStudyPlan {
  // Try to find a JSON block in the response
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.weeks && Array.isArray(parsed.weeks)) {
        return {
          targetExamDate:    parsed.targetExamDate ?? targetExamDate,
          estimatedReadyDate: parsed.estimatedReadyDate ?? deriveEstimatedDate(parsed.weeks.length),
          totalWeeks:        parsed.totalWeeks ?? parsed.weeks.length,
          weeks:             parsed.weeks,
        };
      }
    } catch {
      // Fall through to default
    }
  }

  // Fallback: 8-week default plan
  return buildDefaultPlan(targetExamDate, dailyGoalMinutes);
}

function deriveEstimatedDate(weeks: number): string {
  const d = new Date();
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().split("T")[0];
}

function buildDefaultPlan(targetExamDate: string | null, dailyGoalMinutes: number): GeneratedStudyPlan {
  const weeks = Array.from({ length: 8 }, (_, i) => ({
    week:         i + 1,
    focusDomains: ["RESILIENT", "PERFORMANCE", "SECURITY"],
    dailyMinutes: dailyGoalMinutes,
    goals: [
      `Complete ${Math.round(dailyGoalMinutes / 3)} practice questions`,
      "Review incorrect answers with AI tutor",
      "Focus on high-weight domains",
    ],
  }));

  return {
    targetExamDate,
    estimatedReadyDate: deriveEstimatedDate(8),
    totalWeeks: 8,
    weeks,
  };
}

/** Use generateObject to produce a validated structured plan as an alternative path. */
export async function generateStudyPlanStructured(
  prompt: string,
  supabase: SupabaseClient<Database>,
  userId: string,
  examId: string,
): Promise<GeneratedStudyPlan> {
  const { object } = await generateObject({
    model: anthropic(AI_MODELS.studyPlan),
    schema: z.object({
      targetExamDate:    z.string().nullable(),
      estimatedReadyDate: z.string(),
      totalWeeks:        z.number().int().min(1).max(52),
      weeks: z.array(z.object({
        week:         z.number().int().min(1),
        focusDomains: z.array(z.string()),
        dailyMinutes: z.number().int().min(5).max(240),
        goals:        z.array(z.string()).min(1).max(10),
      })),
    }),
    prompt,
  });

  return object;
}
