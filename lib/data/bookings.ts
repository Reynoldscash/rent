import type { SupabaseClient } from "@supabase/supabase-js";
import { isUuid } from "@/lib/api";

export type BookingStatus = "pending" | "approved" | "paid" | "rejected" | "cancelled" | "completed";
export const BOOKING_STATUSES: BookingStatus[] = ["pending", "approved", "paid", "rejected", "cancelled", "completed"];

type Person = { id: string; full_name: string | null } | null;

export type BookingRow = {
  id: string;
  listing_id: string;
  renter_id: string;
  owner_id: string;
  start_date: string;
  end_date: string;
  status: BookingStatus;
  total_price: number;
  approved_at: string | null;
  created_at: string;
  listing: { id: string; title: string } | null; // null if the listing is inactive and you're the renter
  renter: Person;
  owner: Person;
};

export type OwnerBookingRow = BookingRow & { renter_banned: boolean };

export type Payment = {
  id: string;
  status: "pending" | "paid" | "failed";
  amount_cents: number;
  needs_refund: boolean;
  created_at: string;
};

export type BookingDetail = BookingRow & { payments: Payment[] };

const SELECT =
  "id, listing_id, renter_id, owner_id, start_date, end_date, status, total_price, approved_at, created_at, " +
  "listing:listings(id, title), " +
  "renter:profiles!bookings_renter_id_fkey(id, full_name), " +
  "owner:profiles!bookings_owner_id_fkey(id, full_name)";

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRow(r: any): BookingRow {
  return {
    ...r,
    total_price: Number(r.total_price),
    listing: one(r.listing),
    renter: one(r.renter),
    owner: one(r.owner),
  };
}

export function parseStatuses(value: string | null | undefined): BookingStatus[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is BookingStatus => (BOOKING_STATUSES as string[]).includes(s));
}

/** GET /api/me/bookings — bookings where the viewer is renter or owner. */
export async function getMyBookings(
  supabase: SupabaseClient,
  viewerId: string,
  opts: { role: "renter" | "owner"; statuses?: BookingStatus[]; listingId?: string },
): Promise<OwnerBookingRow[]> {
  let query = supabase
    .from("bookings")
    .select(SELECT)
    .eq(opts.role === "owner" ? "owner_id" : "renter_id", viewerId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (opts.statuses?.length) query = query.in("status", opts.statuses);
  if (opts.listingId) query = query.eq("listing_id", opts.listingId);

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []).map(toRow);

  let banned = new Set<string>();
  if (opts.role === "owner" && rows.length) {
    const { data: bans } = await supabase.from("owner_bans").select("banned_user_id");
    banned = new Set((bans ?? []).map((b) => b.banned_user_id as string));
  }
  return rows.map((r) => ({ ...r, renter_banned: banned.has(r.renter_id) }));
}

/** GET /api/bookings/:id — null if the viewer isn't a participant. */
export async function getBooking(supabase: SupabaseClient, id: string): Promise<BookingDetail | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await supabase.from("bookings").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: payments } = await supabase
    .from("payments")
    .select("id, status, amount_cents, needs_refund, created_at")
    .eq("booking_id", id)
    .order("created_at", { ascending: false });
  return { ...toRow(data), payments: payments ?? [] };
}

/** The viewer's review for a booking, if they wrote one (renters can read their own reviews). */
export async function getMyReview(supabase: SupabaseClient, bookingId: string) {
  if (!isUuid(bookingId)) return null;
  const { data } = await supabase
    .from("reviews")
    .select("id, rating, comment, created_at")
    .eq("booking_id", bookingId)
    .maybeSingle();
  return data as { id: string; rating: number; comment: string | null; created_at: string } | null;
}
