import { z } from "zod";
import { protectedProcedure, router } from "../init";

export const tutorRouter = router({
  // List all conversations for the current user, newest first
  listConversations: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase
      .from("tutor_conversations")
      .select("id, title, mode, messages, updated_at")
      .eq("user_id", ctx.user.id)
      .order("updated_at", { ascending: false })
      .limit(20);

    return (data ?? []).map((row) => ({
      id:       row.id       as string,
      title:    row.title    as string,
      mode:     row.mode     as "socratic" | "direct",
      savedAt:  row.updated_at as string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: row.messages as any[],
    }));
  }),

  // Upsert a conversation (insert or update by id)
  saveConversation: protectedProcedure
    .input(z.object({
      id:       z.string(),
      title:    z.string().max(200),
      messages: z.array(z.any()),
      mode:     z.enum(["socratic", "direct"]),
    }))
    .mutation(async ({ ctx, input }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (ctx.supabase.from("tutor_conversations") as any).upsert(
        {
          id:         input.id,
          user_id:    ctx.user.id,
          title:      input.title,
          messages:   input.messages,
          mode:       input.mode,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    }),

  // Delete a conversation (user can only delete their own)
  deleteConversation: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.supabase
        .from("tutor_conversations")
        .delete()
        .eq("id", input.id)
        .eq("user_id", ctx.user.id);
    }),
});
