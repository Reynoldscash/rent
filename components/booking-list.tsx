import Link from "next/link";
import type { OwnerBookingRow } from "@/lib/data/bookings";
import { daysBetween, formatDate, formatUsd } from "@/lib/dates";
import { StatusBadge } from "@/components/ui";
import { BookingActions } from "@/components/booking-actions";

export function BookingList({ rows, role }: { rows: OwnerBookingRow[]; role: "renter" | "owner" }) {
  return (
    <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
      {rows.map((b) => {
        const days = daysBetween(b.start_date, b.end_date);
        const other = role === "owner" ? b.renter : b.owner;
        return (
          <li key={b.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/bookings/${b.id}`} className="truncate font-medium hover:underline">
                  {b.listing?.title ?? "Listing no longer available"}
                </Link>
                <StatusBadge status={b.status} />
              </div>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {formatDate(b.start_date)} → {formatDate(b.end_date)} · {days} day{days === 1 ? "" : "s"} ·{" "}
                {formatUsd(b.total_price)}
              </p>
              <p className="text-sm text-neutral-500">
                {role === "owner" ? "Renter" : "Owner"}: {other?.full_name ?? "Easy Rent member"}
              </p>
            </div>
            <BookingActions
              bookingId={b.id}
              status={b.status}
              role={role}
              renterId={role === "owner" ? b.renter_id : undefined}
              renterName={b.renter?.full_name}
              renterBanned={b.renter_banned}
            />
          </li>
        );
      })}
    </ul>
  );
}
