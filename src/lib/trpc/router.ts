import { router } from "./init";
import { authRouter } from "./routers/auth";
import { onboardingRouter } from "./routers/onboarding";
import { studyRouter } from "./routers/study";
import { mockRouter } from "./routers/mock";
import { progressRouter } from "./routers/progress";
import { leaderboardRouter } from "./routers/leaderboard";
import { profileRouter } from "./routers/profile";
import { subscriptionRouter } from "./routers/subscription";

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

// Re-export procedure builders so existing code that imports from
// router.ts continues to work (e.g. any future direct imports).
export { router, publicProcedure, protectedProcedure } from "./init";
