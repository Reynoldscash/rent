import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

// POST /api/payments/webhook — api-spec.md §5. Stripe only; system operation.
// Subscribe the endpoint to: checkout.session.completed,
// checkout.session.async_payment_succeeded, checkout.session.async_payment_failed,
// checkout.session.expired.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const payload = await request.text(); // raw body is required for signature checks
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let status: "paid" | "failed" | null = null;
  const session = event.data.object as Stripe.Checkout.Session;
  switch (event.type) {
    case "checkout.session.completed":
      // Card payments are paid here; delayed methods arrive via async_payment_succeeded.
      status = session.payment_status === "paid" ? "paid" : null;
      break;
    case "checkout.session.async_payment_succeeded":
      status = "paid";
      break;
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired":
      status = "failed";
      break;
    default:
      return NextResponse.json({ received: true });
  }
  if (!status) return NextResponse.json({ received: true });

  const bookingId = session.metadata?.booking_id ?? session.client_reference_id;
  if (!bookingId) return NextResponse.json({ received: true }); // not one of ours

  const paymentIntent =
    typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);

  // apply_stripe_payment is idempotent: paid + approved → booking paid;
  // paid + cancelled/already paid → needs_refund = true.
  const { error } = await createAdminClient().rpc("apply_stripe_payment", {
    p_session_id: session.id,
    p_booking_id: bookingId,
    p_payment_intent: paymentIntent,
    p_amount_cents: session.amount_total ?? 0,
    p_status: status,
  });
  if (error) {
    console.error("apply_stripe_payment failed", { eventId: event.id, error });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 }); // Stripe will retry
  }

  return NextResponse.json({ received: true });
}
