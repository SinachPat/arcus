import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import type { SubscriptionStatus } from "@/types/database";

// Use service-role client so webhook can write without user session.
// No Database generic here — the webhook upserts into Stripe-managed tables
// (customers, subscriptions) that live outside the tRPC type surface.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createServiceClient() {
  return createClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServiceClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.customer && session.client_reference_id) {
        await supabase.from("customers").upsert({
          user_id: session.client_reference_id,
          stripe_customer_id: session.customer as string,
        });
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const { data: customer } = await supabase
        .from("customers")
        .select("user_id")
        .eq("stripe_customer_id", sub.customer as string)
        .single();

      if (customer) {
        await supabase.from("subscriptions").upsert({
          id: sub.id,
          user_id: customer.user_id,
          status: sub.status as SubscriptionStatus,
          price_id: sub.items.data[0]?.price.id ?? null,
          product_id: sub.items.data[0]?.price.product as string ?? null,
          quantity: sub.items.data[0]?.quantity ?? 1,
          cancel_at_period_end: sub.cancel_at_period_end,
          trial_start: sub.trial_start ? new Date(sub.trial_start * 1000).toISOString() : null,
          trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await supabase
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("id", sub.id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
