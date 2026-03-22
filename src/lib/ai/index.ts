import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";

// Use Vercel AI Gateway when configured, otherwise use providers directly.
// Trim and discard values that are blank or start with '#' (comment artifacts
// from .env.local being copied into Vercel env vars literally).
const rawGateway = process.env.AI_GATEWAY_URL?.trim() ?? "";
const gatewayUrl = rawGateway && !rawGateway.startsWith("#") ? rawGateway : null;

export const openai = createOpenAI({
  ...(gatewayUrl ? { baseURL: `${gatewayUrl}/openai` } : {}),
});

// @ai-sdk/anthropic@3 defaults to https://api.anthropic.com (missing /v1),
// which returns 404. Explicitly set the correct Messages API base URL.
export const anthropic = createAnthropic({
  baseURL: gatewayUrl ? `${gatewayUrl}/anthropic` : "https://api.anthropic.com/v1",
});

// Default model shortcuts
export const defaultModel = openai("gpt-4o");
export const fastModel = openai("gpt-4o-mini");
