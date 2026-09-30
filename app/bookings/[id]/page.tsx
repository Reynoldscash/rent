import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/page-auth";
import { getBooking, getMyReview } from "@/lib/data/bookings";
import { daysBetween, formatDate, formatUsd } from "@/lib/dates";
import { BookingActions } from "@/components/booking-actions";
import { Notice } from "@/components/auth-form";
import { PageTitle, StatusBadge, btn } from "@/components/ui";
import { PayButton } from "@/components/pay-button";
import { canStartCheckout, formatDeadline, paymentDeadline } from "@/lib/payments";

// frontend-structure.md §5.3 — details, cancel/approve, Pay now, Leave review.
// Messages come with the messaging step.
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ payment?: string }> };

export const metadata = { title: "Booking · Easy Rent" };

export default async function BookingPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { payment } = await searchParams;
  const { supabase, viewer } = await requirePageUser(`/bookings/${id}`);

  const b = await getBooking(supabase, id);
  if (!b) notFound();

  const role = b.owner_id === viewer.id ? "owner" : "renter";
  const days = daysBetween(b.start_date, b.end_date);
  const paid = b.payments.find((p) => p.status === "paid");
  const review = role === "renter" && b.status === "completed" ? await getMyReview(supabase, b.id) : null;
  const deadline = b.approved_at ? paymentDeadline(b.approved_at) : null;
  let banned = false;
  if (role === "owner") {
    const { data } = await supabase.from("owner_bans").select("id").eq("banned_user_id", b.renter_id).maybeSingle();
    banned = Boolean(data);
  }

  return (
    <div className="max-w-2xl py-8">
      <PageTitle
        title={b.listing?.title ?? "Booking"}
        back={role === "owner" ? { href: "/dashboard/requests", label: "Incoming requests" } : { href: "/bookings", label: "My bookings" }}
      />

      {payment === "success" && (
        <div className="mb-4">
          <Notice>Payment received. It can take a moment for the status below to update.</Notice>
        </div>
      )}
      {payment === "cancelled" && (
        <p className="mb-4 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700">
          Payment cancelled. You haven&apos;t been charged.
        </p>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
        <dt className="text-neutral-500">Status</dt>
        <dd>
          <StatusBadge status={b.status} />
        </dd>
        <dt className="text-neutral-500">Dates</dt>
        <dd>
          {formatDate(b.start_date)} → {formatDate(b.end_date)} ({days} day{days === 1 ? "" : "s"})
        </dd>
        <dt className="text-neutral-500">Total</dt>
        <dd className="font-medium">{formatUsd(b.total_price)}</dd>
        <dt className="text-neutral-500">Payment</dt>
        <dd>
          {paid
            ? "Paid"
            : b.status === "approved" && deadline
              ? `Awaiting payment — due by ${formatDeadline(deadline)}`
              : "—"}
          {b.payments.some((p) => p.needs_refund) && " · Refund pending"}
        </dd>
        <dt className="text-neutral-500">{role === "owner" ? "Renter" : "Owner"}</dt>
        <dd>{(role === "owner" ? b.renter : b.owner)?.full_name ?? "Easy Rent member"}</dd>
        {b.listing && (
          <>
            <dt className="text-neutral-500">Listing</dt>
            <dd>
              <Link href={role === "owner" ? `/dashboard/listings/${b.listing.id}` : `/listings/${b.listing.id}`} className="underline">
                {b.listing.title}
              </Link>
            </dd>
          </>
        )}
      </dl>

      {role === "renter" && b.status === "approved" && (
        <div className="mt-6">
          {canStartCheckout(b.approved_at) ? (
            <PayButton bookingId={b.id} label={`Pay ${formatUsd(b.total_price)} now`} />
          ) : (
            <p className="rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700">
              The payment window for this booking has closed.
            </p>
          )}
        </div>
      )}

      {role === "renter" && b.status === "completed" && (
        <div className="mt-6">
          {review ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">You reviewed this rental ({"★".repeat(review.rating)}).</p>
          ) : (
            <Link href={`/bookings/${b.id}/review`} className={btn.primary}>
              Leave a review
            </Link>
          )}
        </div>
      )}

      <div className="mt-6">
        <BookingActions
          bookingId={b.id}
          status={b.status}
          role={role}
          renterId={role === "owner" ? b.renter_id : undefined}
          renterName={b.renter?.full_name}
          renterBanned={banned}
        />
        {role === "renter" && b.status === "paid" && (
          <p className="mt-3 text-sm text-neutral-500">Need to cancel a paid booking? Please contact the owner.</p>
        )}
      </div>
    </div>
  );
}
