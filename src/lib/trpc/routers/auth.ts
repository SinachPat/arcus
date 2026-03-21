import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../init";

export const authRouter = router({
  /** Get the current user's profile row. */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("user_profiles")
      .select("*, users(*)")
      .eq("user_id", ctx.user.id)
      .single();

    if (error) throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found." });
    return data;
  }),

  /** Update display name or timezone. */
  updateProfile: protectedProcedure
    .input(
      z.object({
        name:     z.string().min(1).max(100).optional(),
        timezone: z.string().optional(),
        avatarUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from("users")
        .update({
          ...(input.name      && { name: input.name }),
          ...(input.timezone  && { timezone: input.timezone }),
          ...(input.avatarUrl && { avatar_url: input.avatarUrl }),
        })
        .eq("id", ctx.user.id);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),
});
