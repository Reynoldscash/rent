import { NextResponse, type NextRequest } from "next/server";
import { dbError, isUuid, jsonError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/api-auth";
import { LISTING_IMAGES_BUCKET, pathFromPublicUrl } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/listings/:id/images — step 3 of the image flow (api-spec.md §2).
// The file is already in storage at listing-images/<listing_id>/<file>.
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!isUuid(id)) return jsonError("Listing not found", 404);
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const body = await readJson(request);
  const imageUrl = typeof body?.image_url === "string" ? body.image_url : "";
  const path = pathFromPublicUrl(LISTING_IMAGES_BUCKET, imageUrl);
  if (!path || !path.startsWith(`${id}/`)) {
    return jsonError("image_url must be an uploaded image for this listing");
  }

  // RLS: only the listing owner can insert.
  const { data, error } = await auth.supabase
    .from("listing_images")
    .insert({ listing_id: id, image_url: imageUrl })
    .select("id, listing_id, image_url, created_at")
    .single();
  if (error) return dbError(error);
  return NextResponse.json(data, { status: 201 });
}
