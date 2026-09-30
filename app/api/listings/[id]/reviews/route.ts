import { NextResponse, type NextRequest } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api";
import { getListingReviews } from "@/lib/data/listings";

// GET /api/listings/:id/reviews — api-spec.md §7 (public_reviews view)
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  try {
    return NextResponse.json(await getListingReviews(supabase, id, 100));
  } catch (e) {
    return dbError(e as PostgrestError);
  }
}
