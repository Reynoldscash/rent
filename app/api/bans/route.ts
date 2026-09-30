import { NextResponse } from "next/server";
import { dbError, isUuid, jsonError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/api-auth";

// POST /api/bans — owner bans a renter they have a booking with (api-spec.md §8).
// RLS requires the booking; the unique constraint prevents duplicates.
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const body = await readJson(request);
  const bannedUserId = body?.banned_user_id;
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) || null : null;
  if (!isUuid(bannedUserId)) return jsonError("banned_user_id is required");

  const { data, error } = await auth.supabase
    .from("owner_bans")
    .insert({ banned_user_id: bannedUserId, reason })
    .select("id, banned_user_id, reason, created_at")
    .single();
  if (error) {
    if (error.code === "23505") return jsonError("This renter is already banned", 409);
    if (error.code === "42501") return jsonError("You can only ban renters who have booked with you", 403);
    return dbError(error);
  }
  return NextResponse.json(data, { status: 201 });
}
