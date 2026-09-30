import { NextResponse, type NextRequest } from "next/server";
import { dbError, isUuid, jsonError } from "@/lib/api";
import { requireUser } from "@/lib/api-auth";

type Ctx = { params: Promise<{ blockId: string }> };

// DELETE /api/blocks/:blockId — owner removes a manual block.
// RLS only allows source = 'manual' on the owner's listings.
export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const { blockId } = await params;
  if (!isUuid(blockId)) return jsonError("Block not found", 404);
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { data, error } = await auth.supabase
    .from("availability_blocks")
    .delete()
    .eq("id", blockId)
    .eq("source", "manual")
    .select("id")
    .maybeSingle();
  if (error) return dbError(error);
  if (!data) return jsonError("Block not found", 404);
  return NextResponse.json({ ok: true });
}
