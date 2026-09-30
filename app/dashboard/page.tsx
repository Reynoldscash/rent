import Link from "next/link";
import { requirePageUser } from "@/lib/page-auth";
import { isViewerVerified } from "@/lib/auth/session";
import { getMyListings } from "@/lib/data/listings";
import { getMyBookings } from "@/lib/data/bookings";
import { formatUsd } from "@/lib/dates";
import { Notice } from "@/components/auth-form";
import { BookingList } from "@/components/booking-list";
import { Empty, ListingStatusBadge, PageTitle, Section, btn } from "@/components/ui";

// frontend-structure.md §5.1
type Props = { searchParams: Promise<{ confirmed?: string }> };

export const metadata = { title: "Dashboard · Easy Rent" };

export default async function DashboardPage({ searchParams }: Props) {
  const { confirmed } = await searchParams;
  const { supabase, viewer } = await requirePageUser("/dashboard");

  const [verified, listings, myBookings, incoming] = await Promise.all([
    isViewerVerified(supabase, viewer.id),
    getMyListings(supabase, viewer.id),
    getMyBookings(supabase, viewer.id, { role: "renter" }),
    getMyBookings(supabase, viewer.id, { role: "owner", statuses: ["pending", "approved"] }),
  ]);
  const pending = incoming.filter((b) => b.status === "pending").length;

  return (
    <div className="py-8">
      <PageTitle title="Dashboard" />
      {confirmed && (
        <div className="mb-4">
          <Notice>Your email is confirmed. Welcome to Easy Rent!</Notice>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-sm text-neutral-500">Verification</p>
          <p className="mt-1 font-medium">{verified ? "Email verified" : "Not verified — check your inbox"}</p>
        </div>
        <Link href="/dashboard/requests" className="rounded-lg border border-neutral-200 p-4 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600">
          <p className="text-sm text-neutral-500">Incoming requests</p>
          <p className="mt-1 font-medium">
            {pending} pending{incoming.length - pending > 0 ? ` · ${incoming.length - pending} awaiting payment` : ""} →
          </p>
        </Link>
      </div>

      <Section
        title="My listings"
        action={
          <div className="flex gap-2">
            {listings.length > 0 && (
              <Link href="/dashboard/listings" className={btn.secondary}>
                Manage all
              </Link>
            )}
            <Link href="/listings/new" className={btn.primary}>
              New listing
            </Link>
          </div>
        }
      >
        {listings.length === 0 ? (
          <Empty>You haven&apos;t listed anything yet.</Empty>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {listings.slice(0, 5).map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <Link href={`/dashboard/listings/${l.id}`} className="min-w-0 truncate font-medium hover:underline">
                  {l.title}
                </Link>
                <span className="flex shrink-0 items-center gap-3 text-sm">
                  {formatUsd(l.price_per_day)}/day <ListingStatusBadge status={l.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="My bookings"
        action={
          myBookings.length > 0 && (
            <Link href="/bookings" className={btn.secondary}>
              See all
            </Link>
          )
        }
      >
        {myBookings.length === 0 ? (
          <Empty>
            No bookings yet.{" "}
            <Link href="/listings" className="underline">
              Browse listings
            </Link>
          </Empty>
        ) : (
          <BookingList rows={myBookings.slice(0, 5)} role="renter" />
        )}
      </Section>
    </div>
  );
}
