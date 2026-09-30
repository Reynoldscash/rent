import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/page-auth";
import { getBooking, getMyReview } from "@/lib/data/bookings";
import { ReviewForm } from "@/components/review-form";
import { PageTitle } from "@/components/ui";

// frontend-structure.md §7.1 — renter reviews a completed booking.
type Props = { params: Promise<{ id: string }> };

export const metadata = { title: "Leave a review · Easy Rent" };

export default async function ReviewPage({ params }: Props) {
  const { id } = await params;
  const { supabase, viewer } = await requirePageUser(`/bookings/${id}/review`);
  const b = await getBooking(supabase, id);
  if (!b || b.renter_id !== viewer.id) notFound();
  const existing = await getMyReview(supabase, id);

  return (
    <div className="py-8">
      <PageTitle title={`Review: ${b.listing?.title ?? "your rental"}`} back={{ href: `/bookings/${id}`, label: "Booking" }} />
      {existing ? (
        <p className="text-sm">
          You already reviewed this booking.{" "}
          <Link href={`/listings/${b.listing_id}`} className="underline">
            See the listing
          </Link>
        </p>
      ) : b.status !== "completed" ? (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          You can leave a review once the rental is completed (the day after the return date).
        </p>
      ) : (
        <ReviewForm bookingId={b.id} listingId={b.listing_id} />
      )}
    </div>
  );
}
