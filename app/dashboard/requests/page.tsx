import Link from "next/link";
import { requirePageUser } from "@/lib/page-auth";
import { getMyBookings, parseStatuses, type BookingStatus } from "@/lib/data/bookings";
import { BookingList } from "@/components/booking-list";
import { Empty, PageTitle } from "@/components/ui";

// frontend-structure.md §8.2 — data: GET /api/me/bookings?role=owner
type Props = { searchParams: Promise<{ status?: string }> };

export const metadata = { title: "Incoming requests · Easy Rent" };

const TABS: { label: string; status: string }[] = [
  { label: "Needs action", status: "pending" },
  { label: "Awaiting payment", status: "approved" },
  { label: "Paid", status: "paid" },
  { label: "Past", status: "completed,rejected,cancelled" },
  { label: "All", status: "all" },
];

export default async function RequestsPage({ searchParams }: Props) {
  const { status = "pending" } = await searchParams;
  const { supabase, viewer } = await requirePageUser("/dashboard/requests");
  const statuses: BookingStatus[] = status === "all" ? [] : parseStatuses(status);
  const rows = await getMyBookings(supabase, viewer.id, { role: "owner", statuses });

  return (
    <div className="py-8">
      <PageTitle title="Incoming requests" back={{ href: "/dashboard", label: "Dashboard" }} />
      <nav className="mb-5 flex flex-wrap gap-2 text-sm">
        {TABS.map((t) => (
          <Link
            key={t.status}
            href={`/dashboard/requests?status=${t.status}`}
            className={`rounded-full px-3 py-1 ${
              t.status === status
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "border border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {status === "pending" && rows.length > 0 && (
        <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
          Approving a request blocks those dates and automatically declines other pending requests that overlap.
          The renter then has 24 hours to pay.
        </p>
      )}
      {rows.length === 0 ? <Empty>Nothing here.</Empty> : <BookingList rows={rows} role="owner" />}
    </div>
  );
}
