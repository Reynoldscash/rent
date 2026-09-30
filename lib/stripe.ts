import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

/** Stripe client (server only). Uses STRIPE_SECRET_KEY — test-mode key until launch. */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  client ??= new Stripe(key);
  return client;
}
