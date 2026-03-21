import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";

// Use Vercel AI Gateway when configured, otherwise use providers directly
const gatewayUrl = process.env.AI_GATEWAY_URL;

export const openai = createOpenAI({
  ...(gatewayUrl ? { baseURL: `${gatewayUrl}/openai` } : {}),
});

export const anthropic = createAnthropic({
  ...(gatewayUrl ? { baseURL: `${gatewayUrl}/anthropic` } : {}),
});

// Default model shortcuts
export const defaultModel = openai("gpt-4o");
export const fastModel = openai("gpt-4o-mini");
