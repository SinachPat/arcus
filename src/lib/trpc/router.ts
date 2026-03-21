import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context";
import { authRouter } from "./routers/auth";
import { onboardingRouter } from "./routers/onboarding";
import { studyRouter } from "./routers/study";
import { mockRouter } from "./routers/mock";
import { progressRouter } from "./routers/progress";
import { leaderboardRouter } from "./routers/leaderboard";
import { profileRouter } from "./routers/profile";
import { subscriptionRouter } from "./routers/subscription";

const t = initTRPC.context<Context>().create();

// ---- Middleware ----

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "You must be signed in." });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

// ---- Procedure builders ----

export const router = t.router;
export const publicProcedure    = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthed);

// ---- App router ----

export const appRouter = router({
  auth:         authRouter,
  onboarding:   onboardingRouter,
  study:        studyRouter,
  mock:         mockRouter,
  progress:     progressRouter,
  leaderboard:  leaderboardRouter,
  profile:      profileRouter,
  subscription: subscriptionRouter,
});

export type AppRouter = typeof appRouter;
