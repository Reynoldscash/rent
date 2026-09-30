import { NextResponse, type NextRequest } from "next/server";
import { dbError, jsonError } from "@/lib/api";
import { bookingAction, setStatus } from "@/lib/booking-actions";

// PATCH /api/bookings/:id/cancel — renter or owner (booking-flow.md §5).
// Paid bookings: owner only, through the owner_cancel_paid_booking function,
// which also releases the dates and flags the payment for a manual refund.
export async function PATCH(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return bookingAction(params, async ({ supabase, viewerId, id }) => {
    const { data: booking, error } = await supabase
      .from("bookings")
      .select("id, status, owner_id")
      .eq("id", id)
      .maybeSingle();
    if (error) return dbError(error);
    if (!booking) return jsonError("Booking not found", 404);

    if (booking.status === "paid") {
      if (booking.owner_id !== viewerId) {
        return jsonError("Paid bookings can't be cancelled here. Please contact the owner.", 403);
      }
      const { error: rpcError } = await supabase.rpc("owner_cancel_paid_booking", { p_booking_id: id });
      if (rpcError) return dbError(rpcError);
      return NextResponse.json({ id, status: "cancelled" });
    }

    return setStatus(supabase, id, "cancelled");
  });
}
