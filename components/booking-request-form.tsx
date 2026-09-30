"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { addDays, daysBetween, formatDate, formatUsd, toUtc } from "@/lib/dates";

type Block = { start_date: string; end_date: string };

type Props = {
  listingId: string;
  pricePerDay: number;
  blocked: Block[];
  today: string; // YYYY-MM-DD, marketplace time zone
};

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function monthKey(iso: string) {
  return iso.slice(0, 7); // YYYY-MM
}

function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

/** Every blocked rental day (end dates are exclusive). */
function expandBlocked(blocks: Block[], today: string) {
  const set = new Set<string>();
  const horizon = addDays(today, 730);
  for (const b of blocks) {
    let d = b.start_date < today ? today : b.start_date;
    const end = b.end_date < horizon ? b.end_date : horizon;
    while (d < end) {
      set.add(d);
      d = addDays(d, 1);
    }
  }
  return set;
}

// Booking request (frontend-structure.md §4.3, booking-flow.md §1).
// The price shown is a preview; the database computes the real total.
export function BookingRequestForm({ listingId, pricePerDay, blocked, today }: Props) {
  const blockedDays = useMemo(() => expandBlocked(blocked, today), [blocked, today]);
  const [month, setMonth] = useState(monthKey(today));
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  // First blocked day on/after the chosen start: the return day can't be later than it.
  const limit = useMemo(() => {
    if (!start) return null;
    const sorted = [...blockedDays].filter((d) => d >= start).sort();
    return sorted[0] ?? null;
  }, [start, blockedDays]);

  const canStart = (d: string) => d >= today && !blockedDays.has(d);
  const canEnd = (d: string) => Boolean(start) && d > start! && (!limit || d <= limit);
  const choosingEnd = Boolean(start && !end);

  function pick(d: string) {
    setError(null);
    if (choosingEnd && canEnd(d)) {
      setEnd(d);
    } else if (canStart(d)) {
      setStart(d);
      setEnd(null);
    }
  }

  async function submit() {
    if (!start || !end) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listingId, start_date: start, end_date: end }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Something went wrong");
      } else {
        setCreatedId(body.id);
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (createdId) {
    return (
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
        <p className="font-medium">Request sent.</p>
        <p className="mt-1">The owner will approve or decline it. If approved, you&apos;ll have 24 hours to pay.</p>
        <Link href={`/bookings/${createdId}`} className="mt-3 inline-block font-medium underline">
          View your booking
        </Link>
      </div>
    );
  }

  // Calendar grid for the visible month
  const first = toUtc(`${month}-01`);
  const leading = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];
  const nights = start && end ? daysBetween(start, end) : 0;

  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {choosingEnd ? "Now choose your return day." : "Choose your pick-up day, then your return day."}
      </p>

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth(shiftMonth(month, -1))}
          disabled={month <= monthKey(today)}
          className="rounded px-2 py-1 text-sm disabled:opacity-30"
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="text-sm font-medium">
          {formatDate(`${month}-01`, { month: "long", year: "numeric" })}
        </span>
        <button
          type="button"
          onClick={() => setMonth(shiftMonth(month, 1))}
          className="rounded px-2 py-1 text-sm"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs">
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-1 text-neutral-500">
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const selectable = choosingEnd ? canEnd(d) || canStart(d) : canStart(d);
          const isStart = d === start;
          const isEnd = d === end;
          const inRange = Boolean(start && end && d > start && d < end);
          const isBlocked = blockedDays.has(d);
          return (
            <button
              key={d}
              type="button"
              disabled={!selectable}
              onClick={() => pick(d)}
              title={isBlocked ? "Unavailable" : undefined}
              className={[
                "rounded py-2 text-sm",
                isStart || isEnd
                  ? "bg-neutral-900 font-semibold text-white dark:bg-white dark:text-neutral-900"
                  : inRange
                    ? "bg-neutral-200 dark:bg-neutral-700"
                    : "hover:bg-neutral-100 dark:hover:bg-neutral-800",
                !selectable && !isStart && !isEnd ? "cursor-not-allowed text-neutral-300 dark:text-neutral-700" : "",
                isBlocked && !isEnd ? "line-through" : "",
              ].join(" ")}
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>

      <div className="mt-4 border-t border-neutral-200 pt-3 text-sm dark:border-neutral-800">
        {start && end ? (
          <>
            <p>
              {formatDate(start)} → {formatDate(end)} · {nights} day{nights === 1 ? "" : "s"}
            </p>
            <p className="mt-1">
              {formatUsd(pricePerDay)} × {nights} ={" "}
              <span className="font-semibold">{formatUsd(pricePerDay * nights)}</span>
            </p>
          </>
        ) : (
          <p className="text-neutral-500">{formatUsd(pricePerDay)} per day</p>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!start || !end || submitting}
        className="mt-4 w-full rounded-md bg-neutral-900 px-4 py-2 font-medium text-white hover:bg-neutral-700 disabled:opacity-40 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {submitting ? "Sending…" : "Request booking"}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-500">You won&apos;t be charged until the owner approves.</p>
    </div>
  );
}
