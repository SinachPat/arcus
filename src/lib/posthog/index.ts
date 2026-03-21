import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;

// Server-side PostHog (Node SDK) — singleton for Route Handlers / Server Actions
export function getPostHogServer(): PostHog {
  if (!posthogClient) {
    posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}
