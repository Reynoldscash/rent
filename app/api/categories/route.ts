import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api";
import { getCategories } from "@/lib/data/listings";
import type { PostgrestError } from "@supabase/supabase-js";

// GET /api/categories — api-spec.md §2
export async function GET() {
  const supabase = await createClient();
  try {
    return NextResponse.json(await getCategories(supabase));
  } catch (e) {
    return dbError(e as PostgrestError);
  }
}
