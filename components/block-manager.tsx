"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { callApi } from "@/lib/client-api";
import { addDays, formatDate } from "@/lib/dates";
import type { Block } from "@/lib/data/listings";
import { btn, inputClass } from "@/components/ui";

// Manual blocks: POST /api/listings/:id/blocks, DELETE /api/blocks/:blockId.
// Booking blocks are shown read-only (the system manages them).
export function BlockManager({ listingId, blocks, today }: { listingId: string; blocks: Block[]; today: string }) {
  const router = useRouter();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!from || !to) return;
    setBusy(true);
    setError(null);
    // The form asks for the last blocked day (inclusive); the API uses an exclusive end date.
    const res = await callApi(`/api/listings/${listingId}/blocks`, "POST", { start_date: from, end_date: addDays(to, 1) });
    setBusy(false);
    if (res.error) return setError(res.error === "Dates unavailable" ? "Those dates overlap an existing block or booking." : res.error);
    setFrom("");
    setTo("");
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    const res = await callApi(`/api/blocks/${id}`, "DELETE");
    setBusy(false);
    if (res.error) setError(res.error);
    router.refresh();
  }

  return (
    <div>
      {blocks.length === 0 ? (
        <p className="text-sm text-neutral-500">No upcoming blocked dates.</p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 text-sm dark:divide-neutral-800 dark:border-neutral-800">
          {blocks.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span>
                {formatDate(b.start_date)} – {formatDate(addDays(b.end_date, -1))}
                <span className="ml-2 text-xs text-neutral-500">
                  {b.source === "manual" ? "Blocked by you" : "Booked"}
                </span>
              </span>
              {b.source === "manual" ? (
                <button type="button" className={btn.secondary} disabled={busy} onClick={() => remove(b.id)}>
                  Unblock
                </button>
              ) : (
                b.booking_id && (
                  <Link href={`/bookings/${b.booking_id}`} className="text-xs underline">
                    View booking
                  </Link>
                )
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium">First blocked day</span>
          <input type="date" min={today} required value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Last blocked day</span>
          <input type="date" min={from || today} required value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
        </label>
        <button type="submit" disabled={busy} className={btn.primary}>
          Block dates
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
