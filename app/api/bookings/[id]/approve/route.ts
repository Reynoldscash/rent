import type { NextRequest } from "next/server";
import { bookingAction, setStatus } from "@/lib/booking-actions";

// PATCH /api/bookings/:id/approve — owner. The database sets approved_at,
// creates the booking block and auto-rejects overlapping pending requests.
export async function PATCH(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return bookingAction(params, ({ supabase, id }) => setStatus(supabase, id, "approved"));
}
