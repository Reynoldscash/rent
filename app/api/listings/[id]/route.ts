import { NextResponse, type NextRequest } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { dbError, isUuid, jsonError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/api-auth";
import { getListingDetail } from "@/lib/data/listings";
import { parseListingInput } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/listings/:id — api-spec.md §2 (includes reviews and blocked date ranges)
export async function GET(_request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  try {
    const listing = await getListingDetail(supabase, id);
    if (!listing) return jsonError("Listing not found", 404);
    return NextResponse.json(listing);
  } catch (e) {
    return dbError(e as PostgrestError);
  }
}

// PATCH /api/listings/:id — owner only (RLS)
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!isUuid(id)) return jsonError("Listing not found", 404);
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const parsed = parseListingInput(await readJson(request), "update");
  if (parsed.error) return jsonError(parsed.error);

  const { data, error } = await auth.supabase
    .from("listings")
    .update(parsed.value)
    .eq("id", id)
    .eq("owner_id", auth.viewer.id)
    .select("*")
    .maybeSingle();
  if (error) return dbError(error);
  if (!data) return jsonError("Listing not found", 404);
  return NextResponse.json(data);
}

// DELETE /api/listings/:id — owner only, and only without booking history
export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!isUuid(id)) return jsonError("Listing not found", 404);
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const { supabase, viewer } = auth;

  const { count, error: countError } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", id)
    .eq("owner_id", viewer.id);
  if (countError) return dbError(countError);
  if ((count ?? 0) > 0) {
    return jsonError("Cannot delete listing with booking history. Set status to inactive instead.", 409);
  }

  const { data, error } = await supabase
    .from("listings")
    .delete()
    .eq("id", id)
    .eq("owner_id", viewer.id)
    .select("id")
    .maybeSingle();
  if (error) return dbError(error);
  if (!data) return jsonError("Listing not found", 404);

  // Best effort: remove the listing's stored photos.
  const { data: files } = await supabase.storage.from("listing-images").list(id);
  if (files?.length) {
    await supabase.storage.from("listing-images").remove(files.map((f) => `${id}/${f.name}`));
  }
  return NextResponse.json({ ok: true });
}
