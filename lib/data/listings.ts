import type { SupabaseClient } from "@supabase/supabase-js";
import { isUuid } from "@/lib/api";
import { marketToday } from "@/lib/dates";

// Shared by the API routes (api-spec.md §2) and the Server Component pages,
// so both return exactly the same data. Runs as the caller (RLS applies).

export type Category = { id: string; name: string; slug: string };

export type ListingSummary = {
  id: string;
  title: string;
  price_per_day: number;
  location: string | null;
  category: { name: string; slug: string } | null;
  image_url: string | null;
  rating: { review_count: number; average_rating: number } | null;
};

export type PublicReview = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_name: string | null;
};

export type ListingDetail = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  price_per_day: number;
  location: string | null;
  status: "active" | "inactive";
  created_at: string;
  category: Category | null;
  owner: { id: string; full_name: string | null; avatar_url: string | null } | null;
  images: { id: string; image_url: string }[];
  rating: { review_count: number; average_rating: number } | null;
  reviews: PublicReview[];
  blocked: { start_date: string; end_date: string }[];
};

export type SearchParams = { q?: string; category?: string; location?: string };

/** Strip characters that have meaning in PostgREST filters / LIKE patterns. */
function cleanTerm(value: string | undefined) {
  return (value ?? "").replace(/[%_,()"'\\*:.]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function getCategories(supabase: SupabaseClient): Promise<Category[]> {
  const { data, error } = await supabase.from("categories").select("id, name, slug").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function searchListings(supabase: SupabaseClient, params: SearchParams): Promise<ListingSummary[]> {
  const q = cleanTerm(params.q);
  const location = cleanTerm(params.location);
  const categorySlug = cleanTerm(params.category);

  let query = supabase
    .from("listings")
    .select("id, title, price_per_day, location, created_at, category:categories(name, slug), listing_images(image_url, created_at)")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(60);

  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  if (location) query = query.ilike("location", `%${location}%`);
  if (categorySlug) {
    const { data: cat } = await supabase.from("categories").select("id").eq("slug", categorySlug).maybeSingle();
    if (!cat) return [];
    query = query.eq("category_id", cat.id);
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = data ?? [];

  const ids = rows.map((r) => r.id as string);
  const ratings = new Map<string, { review_count: number; average_rating: number }>();
  if (ids.length) {
    const { data: r } = await supabase
      .from("listing_ratings")
      .select("listing_id, review_count, average_rating")
      .in("listing_id", ids);
    for (const row of r ?? []) {
      ratings.set(row.listing_id, { review_count: row.review_count, average_rating: Number(row.average_rating) });
    }
  }

  return rows.map((r) => {
    const images = ((r.listing_images ?? []) as { image_url: string; created_at: string }[])
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    return {
      id: r.id,
      title: r.title,
      price_per_day: Number(r.price_per_day),
      location: r.location,
      category: one(r.category as { name: string; slug: string } | { name: string; slug: string }[] | null),
      image_url: images[0]?.image_url ?? null,
      rating: ratings.get(r.id) ?? null,
    };
  });
}

export async function getListingReviews(supabase: SupabaseClient, listingId: string, limit = 20): Promise<PublicReview[]> {
  if (!isUuid(listingId)) return [];
  const { data, error } = await supabase
    .from("public_reviews")
    .select("id, rating, comment, created_at, reviewer_name")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Active listing, or the viewer's own inactive listing. null if not visible. */
export async function getListingDetail(supabase: SupabaseClient, id: string): Promise<ListingDetail | null> {
  if (!isUuid(id)) return null;

  const { data: l, error } = await supabase
    .from("listings")
    .select(
      "id, owner_id, title, description, price_per_day, location, status, created_at, " +
        "category:categories(id, name, slug), " +
        "owner:profiles!listings_owner_id_fkey(id, full_name, avatar_url), " +
        "listing_images(id, image_url, created_at)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!l) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = l as any;

  const [ratingRes, reviews, blocksRes] = await Promise.all([
    supabase.from("listing_ratings").select("review_count, average_rating").eq("listing_id", id).maybeSingle(),
    getListingReviews(supabase, id),
    supabase
      .from("availability_blocks")
      .select("start_date, end_date")
      .eq("listing_id", id)
      .gt("end_date", marketToday())
      .order("start_date"),
  ]);

  const images = ((row.listing_images ?? []) as { id: string; image_url: string; created_at: string }[])
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(({ id: imageId, image_url }) => ({ id: imageId, image_url }));

  return {
    id: row.id,
    owner_id: row.owner_id,
    title: row.title,
    description: row.description,
    price_per_day: Number(row.price_per_day),
    location: row.location,
    status: row.status,
    created_at: row.created_at,
    category: one(row.category),
    owner: one(row.owner),
    images,
    rating: ratingRes.data
      ? { review_count: ratingRes.data.review_count, average_rating: Number(ratingRes.data.average_rating) }
      : null,
    reviews,
    blocked: blocksRes.data ?? [],
  };
}

export type MyListing = {
  id: string;
  title: string;
  price_per_day: number;
  location: string | null;
  status: "active" | "inactive";
  created_at: string;
  image_url: string | null;
};

/** GET /api/me/listings — the viewer's own listings, active and inactive. */
export async function getMyListings(supabase: SupabaseClient, viewerId: string): Promise<MyListing[]> {
  const { data, error } = await supabase
    .from("listings")
    .select("id, title, price_per_day, location, status, created_at, listing_images(image_url, created_at)")
    .eq("owner_id", viewerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => {
    const images = ((r.listing_images ?? []) as { image_url: string; created_at: string }[])
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    return {
      id: r.id,
      title: r.title,
      price_per_day: Number(r.price_per_day),
      location: r.location,
      status: r.status,
      created_at: r.created_at,
      image_url: images[0]?.image_url ?? null,
    };
  });
}

export type Block = {
  id: string;
  start_date: string;
  end_date: string;
  source: "manual" | "booking";
  booking_id: string | null;
};

/** Current and future blocks for a listing, with ids (for the owner's editor). */
export async function getListingBlocks(supabase: SupabaseClient, listingId: string): Promise<Block[]> {
  if (!isUuid(listingId)) return [];
  const { data, error } = await supabase
    .from("availability_blocks")
    .select("id, start_date, end_date, source, booking_id")
    .eq("listing_id", listingId)
    .gt("end_date", marketToday())
    .order("start_date");
  if (error) throw error;
  return data ?? [];
}
