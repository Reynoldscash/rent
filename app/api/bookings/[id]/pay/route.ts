import { NextResponse, type NextRequest } from "next/server";
import { dbError, isUuid, jsonError } from "@/lib/api";
import { requireUser } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { SITE_URL } from "@/lib/env";
import { canStartCheckout, paymentDeadline } from "@/lib/payments";

// POST /api/bookings/:id/pay — api-spec.md §5.
// Reads the booking as the signed-in renter (RLS). The service role is used
// only to record the Checkout session (record_checkout_session is system-only).
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return jsonError("Booking not found", 404);
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, viewer } = auth;

  const { data: b, error } = await supabase
    .from("bookings")
    .select("id, renter_id, status, approved_at, total_price, start_date, end_date, listing:listings(title)")
    .eq("id", id)
    .maybeSingle();
  if (error) return dbError(error);
  if (!b || b.renter_id !== viewer.id) return jsonError("Booking not found", 404);
  if (b.status !== "approved") return jsonError("This booking isn't awaiting payment", 409);
  if (!canStartCheckout(b.approved_at)) return jsonError("Payment window closed", 409);

  const stripe = getStripe();

  // Reuse a still-open session instead of creating duplicates.
  const { data: pending } = await supabase
    .from("payments")
    .select("stripe_session_id")
    .eq("booking_id", id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1);
  if (pending?.[0]) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(pending[0].stripe_session_id);
      if (existing.status === "open" && existing.url) return NextResponse.json({ url: existing.url });
    } catch {
      // fall through and create a new session
    }
  }

  const amountCents = Math.round(Number(b.total_price) * 100);
  const listing = Array.isArray(b.listing) ? b.listing[0] : b.listing;
  const deadline = paymentDeadline(b.approved_at!);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    submit_type: "book",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: `Rental: ${listing?.title ?? "Easy Rent booking"}`,
            description: `${b.start_date} to ${b.end_date}`,
          },
        },
      },
    ],
    client_reference_id: id,
    metadata: { booking_id: id },
    payment_intent_data: { metadata: { booking_id: id } },
    customer_email: viewer.email ?? undefined,
    expires_at: Math.floor(deadline.getTime() / 1000),
    success_url: `${SITE_URL}/bookings/${id}?payment=success`,
    cancel_url: `${SITE_URL}/bookings/${id}?payment=cancelled`,
  });

  const admin = createAdminClient();
  const { error: recordError } = await admin.rpc("record_checkout_session", {
    p_booking_id: id,
    p_session_id: session.id,
    p_amount_cents: amountCents,
  });
  if (recordError) {
    // The booking changed underneath us (e.g. expired) — don't leave a payable session open.
    await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
    return dbError(recordError);
  }

  return NextResponse.json({ url: session.url });
}
