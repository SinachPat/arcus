import { streamText, tool, convertToModelMessages } from "ai";
import { z } from "zod";
import { anthropic } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";
import { AI_MESSAGE_LIMITS, AI_MODELS, AI_COST } from "@/lib/constants";
import type { DbUserProfile, DbUserAiCosts } from "@/types/database";

export const runtime = "edge";

// ── Context type ───────────────────────────────────────────────────────────

interface TutorContext {
  questionId?: string;
  questionContent?: string;
  userAnswer?: string[];
  correctAnswer?: string[];
  explanation?: string;
  domainName?: string;
  masteryPercent?: number;
}

// ── System prompt ──────────────────────────────────────────────────────────

function buildSystem(mode: "socratic" | "direct", ctx: TutorContext | null): string {
  const ctxBlock = ctx
    ? `\n## Active Question Context\nQuestion: ${ctx.questionContent ?? "N/A"}\nUser selected: ${ctx.userAnswer?.join("; ") ?? "N/A"}\nCorrect answer: ${ctx.correctAnswer?.join("; ") ?? "N/A"}\nExplanation: ${ctx.explanation ?? "N/A"}\nDomain: ${ctx.domainName ?? "N/A"} · Mastery: ${ctx.masteryPercent !== undefined ? `${ctx.masteryPercent}%` : "N/A"}\n`
    : "";

  if (mode === "socratic") {
    return `You are an AWS Solutions Architect exam tutor using the Socratic method.
Guide students to discover answers through thoughtful questions — never give answers directly.
When a student got a question wrong: open with a probing question that surfaces their misconception, step them through the reasoning with follow-up questions, only confirm the correct answer once they've reasoned to it.
Tie every concept to real AWS use-cases and the Well-Architected Framework.
Keep responses concise (2–4 paragraphs). Use markdown.${ctxBlock}`;
  }

  return `You are an AWS Solutions Architect exam tutor. Give clear, direct explanations.
When explaining a concept: state the answer immediately, explain the why with AWS reasoning, compare to alternative services, and reference the Well-Architected Framework pillars when relevant.
Be practical and exam-focused. Use markdown, bullets, and code blocks as needed.${ctxBlock}`;
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // Fetch profile + AI cost in parallel
  const [profileResult, costsResult] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("user_id", user.id).single(),
    supabase.from("user_ai_costs").select("*").eq("user_id", user.id).eq("billing_month", new Date().toISOString().slice(0, 7)).maybeSingle(),
  ]);

  const profile = profileResult.data as DbUserProfile | null;
  const aiCosts = costsResult.data as DbUserAiCosts | null;

  const tier = profile?.subscription_tier ?? "free";
  const dailyLimit = AI_MESSAGE_LIMITS[tier] ?? AI_MESSAGE_LIMITS.free;
  const dailyUsed = profile?.daily_ai_messages_used ?? 0;

  // Daily rate limit
  if (dailyUsed >= dailyLimit) {
    return new Response(JSON.stringify({ error: "rate_limited", limit: dailyLimit, used: dailyUsed }), { status: 429, headers: { "Content-Type": "application/json" } });
  }

  // Circuit breaker
  if (aiCosts && aiCosts.ai_cost_usd >= AI_COST.CIRCUIT_BREAKER_DAILY_USD) {
    const msSince = Date.now() - new Date(aiCosts.last_updated_at).getTime();
    if (msSince < AI_COST.RATE_LIMIT_INTERVAL_MS) {
      const waitSec = Math.ceil((AI_COST.RATE_LIMIT_INTERVAL_MS - msSince) / 1000);
      return new Response(JSON.stringify({ error: "circuit_breaker", waitSeconds: waitSec }), { status: 429, headers: { "Content-Type": "application/json" } });
    }
  }

  // Parse request
  const body = await request.json();
  // DefaultChatTransport sends UIMessage[] — convertToModelMessages converts them
  // to the CoreMessage format that streamText / Anthropic expect.
  const uiMessages: unknown[] = body.messages ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages = convertToModelMessages(uiMessages as any);
  const mode: "socratic" | "direct" = body.mode ?? "socratic";
  const context: TutorContext | null = body.context ?? null;

  // Increment usage (non-blocking)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  void (supabase.from("user_profiles") as any)
    .update({ daily_ai_messages_used: dailyUsed + 1 })
    .eq("user_id", user.id);

  const modelId = mode === "socratic" ? AI_MODELS.tutorSocratic : AI_MODELS.tutorDirect;

  // Cast needed: @ai-sdk/anthropic@3 returns LanguageModelV3 which is in the LanguageModel union
  // but TypeScript can't resolve the cross-package types without an explicit cast.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const streamArgs: any = {
    model: anthropic(modelId),
    system: buildSystem(mode, context),
    messages,
    maxOutputTokens: 1024,
    tools: {
      generatePracticeQuestion: tool({
        description: "Generate a focused practice question on a specific AWS topic.",
        inputSchema: z.object({
          topic: z.string().describe("AWS topic or service"),
          difficulty: z.number().min(1).max(5).describe("Difficulty 1–5"),
        }),
        execute: async (args) => ({
          question: `Practice (${args.difficulty}/5): What is the AWS best practice for ${args.topic}?`,
          difficulty: args.difficulty,
          topic: args.topic,
          note: "Try answering before asking for hints.",
        }),
      }),

      lookupDocumentation: tool({
        description: "Return the AWS documentation URL for a given service or concept.",
        inputSchema: z.object({
          service: z.string().describe("AWS service, e.g. 'S3', 'Lambda', 'RDS'"),
          topic: z.string().optional().describe("Specific sub-topic"),
        }),
        execute: async (args) => ({
          service: args.service,
          topic: args.topic ?? "overview",
          url: `https://docs.aws.amazon.com/${args.service.toLowerCase().replace(/\s+/g, "")}/latest/userguide/`,
          note: `Official AWS ${args.service} documentation`,
        }),
      }),

      checkUserProgress: tool({
        description: "Retrieve the student's mastery data for a domain to personalise coaching.",
        inputSchema: z.object({
          domainName: z.string().describe("Domain name, e.g. 'Design Resilient Architectures'"),
        }),
        execute: async (args) => {
          const { data } = await supabase
            .from("user_domain_progress")
            .select("mastery_percent, questions_answered, last_practiced_at")
            .eq("user_id", user.id)
            .maybeSingle();
          // Cast because partial selects lose type info
          const row = data as { mastery_percent?: number; questions_answered?: number; last_practiced_at?: string } | null;
          return {
            domainName: args.domainName,
            mastery: row?.mastery_percent ?? 0,
            questionsAnswered: row?.questions_answered ?? 0,
            lastPracticed: row?.last_practiced_at ?? null,
          };
        },
      }),

      createFlashcard: tool({
        description: "Save a flashcard to help the student remember a key concept.",
        inputSchema: z.object({
          front: z.string().describe("Question or concept on the front"),
          back: z.string().describe("Answer or explanation on the back"),
          topic: z.string().optional().describe("AWS topic area, e.g. 'S3'"),
        }),
        execute: async (args) => {
          // Cast needed: hand-written Database type causes insert overload to resolve to never
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data, error } = await (supabase.from("flashcards") as any)
            .insert({ user_id: user.id, front: args.front, back: args.back, topic: args.topic ?? null, domain_id: null })
            .select("id")
            .single();
          if (error) return { success: false, reason: "Could not save flashcard." };
          const row = data as { id: string };
          return { success: true, flashcardId: row.id, front: args.front, back: args.back };
        },
      }),
    },
  };
  const result = streamText(streamArgs);

  return result.toUIMessageStreamResponse();
}
