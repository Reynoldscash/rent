import { NextResponse, type NextRequest } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";
import { dbError, jsonError } from "@/lib/api";
import { requireUser } from "@/lib/api-auth";
import { getMyBookings, parseStatuses } from "@/lib/data/bookings";

// GET /api/me/bookings?role=renter|owner&status=pending,approved — api-spec.md §1
export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const sp = request.nextUrl.searchParams;
  const role = sp.get("role") ?? "renter";
  if (role !== "renter" && role !== "owner") return jsonError("role must be renter or owner");

  try {
    const rows = await getMyBookings(auth.supabase, auth.viewer.id, {
      role,
      statuses: parseStatuses(sp.get("status")),
    });
    return NextResponse.json(rows);
  } catch (e) {
    return dbError(e as PostgrestError);
  }
}
