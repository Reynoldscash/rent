import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dbError, isUuid, jsonError, readJson } from "@/lib/api";
import { isIsoDate } from "@/lib/dates";
import { getViewer } from "@/lib/auth/session";

// POST /api/bookings — api-spec.md §4
// Runs as the signed-in renter. The database trigger sets owner_id,
// total_price and status, and enforces verification, bans, dates and blocks.
export async function POST(request: Request) {
  const supabase = await createClient();
  const viewer = await getViewer(supabase);
  if (!viewer) return jsonError("Sign in to request a booking", 401);

  const body = await readJson(request);
  const listingId = body?.listing_id;
  const startDate = body?.start_date;
  const endDate = body?.end_date;

  if (!isUuid(listingId) || !isIsoDate(startDate) || !isIsoDate(endDate)) {
    return jsonError("listing_id, start_date and end_date (YYYY-MM-DD) are required", 400);
  }

  // Only these three columns are sent; anything else in the body is ignored.
  const { data, error } = await supabase
    .from("bookings")
    .insert({ listing_id: listingId, start_date: startDate, end_date: endDate })
    .select("id, listing_id, start_date, end_date, status, total_price, created_at")
    .single();

  if (error) return dbError(error);
  return NextResponse.json(data, { status: 201 });
}
