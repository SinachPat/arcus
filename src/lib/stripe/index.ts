import Stripe from "stripe";

// Lazily initialized — avoids throwing at module load time during Next.js
// static analysis / page data collection when STRIPE_SECRET_KEY may not
// be present in the build environment.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    _stripe = new Stripe(key, {
      apiVersion: "2026-02-25.clover",
      typescript: true,
    });
  }
  return _stripe;
}

// Convenience re-export matching the old API so existing imports
// `import { stripe } from "@/lib/stripe"` keep working.
// NOTE: accessing `.stripe` at import-time is still eager; import `getStripe` instead.
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
