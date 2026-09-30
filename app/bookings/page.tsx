import Link from "next/link";
import { requirePageUser } from "@/lib/page-auth";
import { getMyBookings } from "@/lib/data/bookings";
import { BookingList } from "@/components/booking-list";
import { Empty, PageTitle } from "@/components/ui";

// frontend-structure.md §5.2 — data: GET /api/me/bookings?role=renter
export const metadata = { title: "My bookings · Easy Rent" };

export default async function MyBookingsPage() {
  const { supabase, viewer } = await requirePageUser("/bookings");
  const rows = await getMyBookings(supabase, viewer.id, { role: "renter" });

  return (
    <div className="py-8">
      <PageTitle title="My bookings" back={{ href: "/dashboard", label: "Dashboard" }} />
      {rows.length === 0 ? (
        <Empty>
          You haven&apos;t booked anything yet.{" "}
          <Link href="/listings" className="underline">
            Browse listings
          </Link>
        </Empty>
      ) : (
        <BookingList rows={rows} role="renter" />
      )}
    </div>
  );
}
