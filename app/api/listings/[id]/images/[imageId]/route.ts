import { NextResponse, type NextRequest } from "next/server";
import { dbError, isUuid, jsonError } from "@/lib/api";
import { requireUser } from "@/lib/api-auth";
import { LISTING_IMAGES_BUCKET, pathFromPublicUrl } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string; imageId: string }> };

// DELETE /api/listings/:id/images/:imageId — removes the record and the stored file.
export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const { id, imageId } = await params;
  if (!isUuid(id) || !isUuid(imageId)) return jsonError("Image not found", 404);
  const auth = await requireUser();
  if (auth.response) return auth.response;

  // RLS: only the listing owner can delete.
  const { data, error } = await auth.supabase
    .from("listing_images")
    .delete()
    .eq("id", imageId)
    .eq("listing_id", id)
    .select("image_url")
    .maybeSingle();
  if (error) return dbError(error);
  if (!data) return jsonError("Image not found", 404);

  const path = pathFromPublicUrl(LISTING_IMAGES_BUCKET, data.image_url);
  if (path) await auth.supabase.storage.from(LISTING_IMAGES_BUCKET).remove([path]);
  return NextResponse.json({ ok: true });
}
