import { NextResponse, type NextRequest } from "next/server";
import { dbError, isUuid, jsonError, readJson } from "@/lib/api";
import { requireUser } from "@/lib/api-auth";
import { isIsoDate, marketToday } from "@/lib/dates";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/listings/:id/blocks — owner adds a manual block (api-spec.md §3).
// source defaults to 'manual'; the overlap constraint rejects clashes.
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!isUuid(id)) return jsonError("Listing not found", 404);
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const body = await readJson(request);
  const start = body?.start_date;
  const end = body?.end_date;
  if (!isIsoDate(start) || !isIsoDate(end)) return jsonError("start_date and end_date (YYYY-MM-DD) are required");
  if (start >= end) return jsonError("The end date must be after the start date.");
  if (end <= marketToday()) return jsonError("Blocked dates must be in the future.");

  const { data, error } = await auth.supabase
    .from("availability_blocks")
    .insert({ listing_id: id, start_date: start, end_date: end })
    .select("id, listing_id, start_date, end_date, source")
    .single();
  if (error) return dbError(error);
  return NextResponse.json(data, { status: 201 });
}
