/**
 * tRPC initializer — exports procedure builders used by all sub-routers.
 *
 * Sub-routers import from HERE (not from router.ts) to avoid the circular
 * dependency: router.ts → routers/*.ts → router.ts, which causes a
 * temporal dead zone error in Turbopack (strict ESM).
 */
import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create();

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "You must be signed in." });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const router            = t.router;
export const publicProcedure   = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthed);
