import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError, isUuid, jsonError } from "@/lib/api";
import { requireUser } from "@/lib/api-auth";

/**
 * Status change as the signed-in user. The bookings_before_update trigger
 * decides whether this user may make this move (booking-flow.md §5).
 */
export async function setStatus(supabase: SupabaseClient, id: string, status: "approved" | "rejected" | "cancelled") {
  const { data, error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", id)
    .select("id, status, approved_at")
    .maybeSingle();
  if (error) return dbError(error);
  if (!data) return jsonError("Booking not found", 404);
  return NextResponse.json(data);
}

export async function bookingAction(
  params: Promise<{ id: string }>,
  run: (ctx: { supabase: SupabaseClient; viewerId: string; id: string }) => Promise<Response>,
) {
  const { id } = await params;
  if (!isUuid(id)) return jsonError("Booking not found", 404);
  const auth = await requireUser();
  if (auth.response) return auth.response;
  return run({ supabase: auth.supabase, viewerId: auth.viewer.id, id });
}
