import { NextResponse } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";
import { dbError } from "@/lib/api";
import { requireUser } from "@/lib/api-auth";
import { getMyListings } from "@/lib/data/listings";

// GET /api/me/listings — api-spec.md §1
export async function GET() {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  try {
    return NextResponse.json(await getMyListings(auth.supabase, auth.viewer.id));
  } catch (e) {
    return dbError(e as PostgrestError);
  }
}
