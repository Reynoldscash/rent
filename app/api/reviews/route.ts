import { NextResponse } from "next/server";
import { dbError, isUuid, jsonError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/api-auth";

// POST /api/reviews — api-spec.md §7. Runs as the renter; the database checks
// the booking is completed and theirs, sets listing_id, and allows one review per booking.
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const body = await readJson(request);
  const bookingId = body?.booking_id;
  const rating = Number(body?.rating);
  const comment = typeof body?.comment === "string" ? body.comment.trim() : "";

  if (!isUuid(bookingId)) return jsonError("booking_id is required");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return jsonError("Rating must be a whole number from 1 to 5");
  if (comment.length > 2000) return jsonError("Comment must be under 2000 characters");

  const { data, error } = await auth.supabase
    .from("reviews")
    .insert({ booking_id: bookingId, rating, comment: comment || null })
    .select("id, booking_id, listing_id, rating, comment, created_at")
    .single();
  if (error) {
    if (error.code === "23505") return jsonError("You've already reviewed this booking", 409);
    return dbError(error);
  }
  return NextResponse.json(data, { status: 201 });
}
