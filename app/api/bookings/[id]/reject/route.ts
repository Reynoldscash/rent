import type { NextRequest } from "next/server";
import { bookingAction, setStatus } from "@/lib/booking-actions";

// PATCH /api/bookings/:id/reject — owner, pending only (enforced by the database).
export async function PATCH(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return bookingAction(params, ({ supabase, id }) => setStatus(supabase, id, "rejected"));
}
