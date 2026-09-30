import { isUuid } from "@/lib/api";

export type ListingInput = {
  title?: string;
  description?: string | null;
  category_id?: string | null;
  price_per_day?: number;
  location?: string | null;
  status?: "active" | "inactive";
};

/**
 * Validates listing fields for POST (all required fields) or PATCH (partial).
 * Only the fields api-spec.md allows are ever returned — anything else is dropped.
 */
export function parseListingInput(
  body: Record<string, unknown> | null,
  mode: "create" | "update",
): { value: ListingInput; error?: undefined } | { value?: undefined; error: string } {
  if (!body) return { error: "Invalid JSON body" };
  const out: ListingInput = {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);

  if (mode === "create" || has("title")) {
    const t = typeof body.title === "string" ? body.title.trim() : "";
    if (t.length < 3 || t.length > 120) return { error: "Title must be 3–120 characters" };
    out.title = t;
  }
  if (has("description")) {
    if (body.description !== null && typeof body.description !== "string") return { error: "Invalid description" };
    const d = (body.description as string | null)?.trim() ?? "";
    if (d.length > 5000) return { error: "Description must be under 5000 characters" };
    out.description = d || null;
  }
  if (has("category_id")) {
    if (body.category_id !== null && body.category_id !== "" && !isUuid(body.category_id)) return { error: "Invalid category" };
    out.category_id = body.category_id ? (body.category_id as string) : null;
  }
  if (mode === "create" || has("price_per_day")) {
    const p = Number(body.price_per_day);
    if (!Number.isFinite(p) || p <= 0 || p > 100000 || Math.abs(Math.round(p * 100) - p * 100) > 1e-6) {
      return { error: "Price per day must be a positive amount with at most 2 decimals" };
    }
    out.price_per_day = p;
  }
  if (has("location")) {
    if (body.location !== null && typeof body.location !== "string") return { error: "Invalid location" };
    const l = (body.location as string | null)?.trim() ?? "";
    if (l.length > 120) return { error: "Location must be under 120 characters" };
    out.location = l || null;
  }
  if (has("status")) {
    if (body.status !== "active" && body.status !== "inactive") return { error: "Status must be active or inactive" };
    out.status = body.status;
  }
  if (mode === "update" && Object.keys(out).length === 0) return { error: "Nothing to update" };
  return { value: out };
}
