import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../init";
import { stripe } from "@/lib/stripe/client";
import { STRIPE_PRICE_IDS, AI_MESSAGE_LIMITS, DAILY_QUESTION_LIMITS, APP_URL } from "@/lib/constants";
import type { SubscriptionTier } from "@/types/database";

export const subscriptionRouter = router({
  /** Current subscription details. */
  get: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("user_profiles")
      .select("subscription_tier, subscription_expires_at, stripe_customer_id, daily_ai_messages_used, daily_ai_messages_reset_at")
      .eq("user_id", ctx.user.id)
      .single();

    if (error) throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found." });

    const tier = (data.subscription_tier ?? "free") as SubscriptionTier;
    return {
      tier,
      expiresAt:             data.subscription_expires_at,
      stripeCustomerId:      data.stripe_customer_id,
      dailyAiMessagesUsed:   data.daily_ai_messages_used,
      dailyAiMessagesLimit:  AI_MESSAGE_LIMITS[tier],
      dailyQuestionsLimit:   DAILY_QUESTION_LIMITS[tier],
    };
  }),

  /** Create a Stripe Checkout Session for upgrading. */
  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        priceKey: z.enum(["PRO_MONTHLY", "PRO_ANNUAL", "PREMIUM_MONTHLY", "PREMIUM_ANNUAL"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const priceId = STRIPE_PRICE_IDS[input.priceKey];
      if (!priceId) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid price." });

      const session = await stripe.checkout.sessions.create({
        mode:                "subscription",
        line_items:          [{ price: priceId, quantity: 1 }],
        client_reference_id: ctx.user.id,
        customer_email:      ctx.user.email,
        success_url:         `${APP_URL}/dashboard?upgrade=success`,
        cancel_url:          `${APP_URL}/settings?upgrade=cancelled`,
        subscription_data: {
          trial_period_days: 7,
          metadata: { userId: ctx.user.id },
        },
      });

      return { url: session.url };
    }),

  /** Create a Stripe Customer Portal session for managing billing. */
  createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
    const { data } = await ctx.supabase
      .from("user_profiles")
      .select("stripe_customer_id")
      .eq("user_id", ctx.user.id)
      .single();

    if (!data?.stripe_customer_id) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No billing account found. Please subscribe first." });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer:   data.stripe_customer_id,
      return_url: `${APP_URL}/settings`,
    });

    return { url: session.url };
  }),
});
