import { NextResponse, type NextRequest } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { dbError, jsonError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/api-auth";
import { isViewerVerified } from "@/lib/auth/session";
import { searchListings } from "@/lib/data/listings";
import { parseListingInput } from "@/lib/validation";

// GET /api/listings?q=&category=&location= — api-spec.md §2
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const supabase = await createClient();
  try {
    const listings = await searchListings(supabase, {
      q: sp.get("q") ?? undefined,
      category: sp.get("category") ?? undefined,
      location: sp.get("location") ?? undefined,
    });
    return NextResponse.json(listings);
  } catch (e) {
    return dbError(e as PostgrestError);
  }
}

// POST /api/listings — api-spec.md §2. owner_id comes from the session (trigger).
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, viewer } = auth;

  if (!(await isViewerVerified(supabase, viewer.id))) {
    return jsonError("You must verify your email to create a listing", 403);
  }

  const parsed = parseListingInput(await readJson(request), "create");
  if (parsed.error) return jsonError(parsed.error);

  const { data, error } = await supabase.from("listings").insert(parsed.value).select("*").single();
  if (error) return dbError(error);
  return NextResponse.json(data, { status: 201 });
}
