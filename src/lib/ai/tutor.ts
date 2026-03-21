import { streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { anthropic } from "./index";
import { AI_MODELS, AI_MESSAGE_LIMITS, AI_COST } from "@/lib/constants";
import type { TutorMode, SubscriptionTier } from "@/types/database";
import type { TutorContext } from "@/types";

const SOCRATIC_SYSTEM = `You are an expert AWS Solutions Architect tutor using the Socratic method.
Your goal is to guide the student to the answer through questions and hints — never reveal the correct answer directly.
Ask clarifying questions, point to relevant AWS concepts, and celebrate when they reason it out themselves.
Be encouraging, concise, and focused on the specific question context provided.
If the user is struggling after 3+ exchanges, offer a stronger hint that narrows the choices without giving away the answer.`;

const DIRECT_SYSTEM = `You are a clear, efficient AWS Solutions Architect tutor.
State the correct answer immediately, then explain the reasoning step by step.
Reference official AWS documentation where relevant.
Keep explanations concise but complete — aim for 3–5 sentences per concept.
If the user asks follow-up questions, answer them directly and clearly.`;

function buildContextBlock(ctx: TutorContext): string {
  if (!ctx.questionContent) return "";
  return `
<question_context>
${ctx.questionContent}
${ctx.domainName ? `Domain: ${ctx.domainName} (mastery: ${ctx.masteryPercent ?? 0}%)` : ""}
${ctx.userAnswer?.length ? `Student's answer: ${ctx.userAnswer.join(", ")}` : ""}
${ctx.correctAnswer?.length ? `Correct answer: ${ctx.correctAnswer.join(", ")}` : ""}
${ctx.explanation ? `Official explanation: ${ctx.explanation}` : ""}
</question_context>`.trim();
}

interface StreamTutorParams {
  messages:     Array<{ role: "user" | "assistant"; content: string }>;
  mode:         TutorMode;
  tier:         SubscriptionTier;
  messagesUsed: number;
  context:      TutorContext;
}

/** Rate limit check — returns error message string or null if allowed. */
function checkRateLimit(tier: SubscriptionTier, messagesUsed: number): string | null {
  const limit = AI_MESSAGE_LIMITS[tier];
  if (messagesUsed >= limit) {
    return tier === "free"
      ? `You've used all ${limit} daily AI messages on the free plan. Upgrade to Pro for 50 messages/day.`
      : `Daily AI message limit (${limit}) reached. Resets at midnight.`;
  }
  return null;
}

/**
 * Stream an AI tutor response. Returns a ReadableStream-compatible response
 * via `toTextStreamResponse()`. Call this from the /api/ai/chat route.
 */
export function streamTutorResponse(params: StreamTutorParams) {
  const { messages, mode, tier, messagesUsed, context } = params;

  const rateLimitError = checkRateLimit(tier, messagesUsed);
  if (rateLimitError) throw new Error(rateLimitError);

  const modelId = mode === "socratic" ? AI_MODELS.tutorSocratic : AI_MODELS.tutorDirect;
  const systemPrompt = mode === "socratic" ? SOCRATIC_SYSTEM : DIRECT_SYSTEM;
  const contextBlock = buildContextBlock(context);

  return streamText({
    model: anthropic(modelId),
    system: contextBlock ? `${systemPrompt}\n\n${contextBlock}` : systemPrompt,
    messages,
    maxTokens: 1024,
    tools: {
      /** Return an AWS documentation reference for a concept. */
      get_aws_docs: tool({
        description: "Look up the official AWS documentation URL for a specific service or concept",
        parameters: z.object({
          service: z.string().describe("AWS service name, e.g. 'S3', 'RDS Multi-AZ', 'CloudFront'"),
        }),
        execute: async ({ service }) => ({
          url: `https://docs.aws.amazon.com/search/doc-search.html?searchPath=documentation&searchQuery=${encodeURIComponent(service)}`,
          note: `Official AWS docs for "${service}"`,
        }),
      }),

      /** Retrieve a Socratic hint for the current question without revealing the answer. */
      get_hint: tool({
        description: "Generate a Socratic hint that guides without revealing the answer",
        parameters: z.object({
          hintLevel: z.number().int().min(1).max(3).describe("1=subtle, 2=medium, 3=strong"),
        }),
        execute: async ({ hintLevel }) => {
          const hints: Record<number, string> = {
            1: "Think about which AWS services are managed vs. unmanaged, and what operational overhead each involves.",
            2: "Focus on the key requirement in the question. Which option directly addresses the MOST important constraint?",
            3: "Eliminate options that add operational complexity or don't meet the specific requirement. The remaining option should be obvious.",
          };
          return { hint: hints[hintLevel] ?? hints[1] };
        },
      }),

      /** Check whether the user's reasoning is on the right track. */
      check_understanding: tool({
        description: "Assess if the user's stated reasoning is correct and provide targeted feedback",
        parameters: z.object({
          userReasoning: z.string().describe("The reasoning the student provided"),
          isOnTrack:     z.boolean().describe("Whether their reasoning leads to the correct answer"),
        }),
        execute: async ({ isOnTrack }) => ({
          feedback: isOnTrack
            ? "Your reasoning is on the right track! Keep going — apply that logic to the specific options."
            : "You're close, but there's a subtle point to reconsider. Think about the specific constraint mentioned in the question.",
        }),
      }),

      /** Surface a related practice question topic for reinforcement. */
      suggest_practice: tool({
        description: "Suggest a related topic or subtopic for further practice",
        parameters: z.object({
          concept: z.string().describe("The specific AWS concept to reinforce"),
        }),
        execute: async ({ concept }) => ({
          suggestion: `Practice questions on: ${concept}`,
          tip: "Mastering this concept typically requires 5–10 spaced repetition questions.",
        }),
      }),
    },
    stopWhen: stepCountIs(3), // Allow tool use within a single message
    temperature: mode === "socratic" ? 0.7 : 0.3,
  });
}

// Re-export for the route handler to call .toTextStreamResponse()
export { AI_COST };
