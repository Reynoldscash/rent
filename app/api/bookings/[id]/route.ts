import { NextResponse, type NextRequest } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";
import { dbError, jsonError } from "@/lib/api";
import { requireUser } from "@/lib/api-auth";
import { getBooking } from "@/lib/data/bookings";

// GET /api/bookings/:id — renter or owner of the booking (RLS).
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireUser();
  if (auth.response) return auth.response;
  try {
    const booking = await getBooking(auth.supabase, id);
    if (!booking) return jsonError("Booking not found", 404);
    return NextResponse.json(booking);
  } catch (e) {
    return dbError(e as PostgrestError);
  }
}
