import { NextResponse } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";

/** Error body format from api-spec.md §10: { "error": "..." } */
export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/**
 * Turns a database error into an API response. Messages raised by our
 * triggers (errcode P0001) are already user-facing (api-spec.md wording).
 */
export function dbError(error: PostgrestError) {
  switch (error.code) {
    case "P0001":
      return jsonError(error.message, 400);
    case "P0002":
      return jsonError(error.message, 404);
    case "42501":
      // RLS / column privilege / disallowed transition
      return jsonError(
        error.message.includes("row-level security") || error.message.includes("permission denied")
          ? "You are not allowed to do that"
          : error.message,
        403,
      );
    case "23P01":
      return jsonError("Dates unavailable", 409);
    case "23505":
      return jsonError("This already exists", 409);
    case "23514":
    case "22P02":
    case "22007":
    case "22008":
      return jsonError("Invalid value", 400);
    default:
      console.error("Unhandled database error", error);
      return jsonError("Something went wrong", 500);
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
