"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { callApi } from "@/lib/client-api";
import { btn, inputClass } from "@/components/ui";

const LABELS = ["Terrible", "Poor", "OK", "Good", "Excellent"];

// POST /api/reviews, then back to the listing (frontend-structure.md §7.1).
export function ReviewForm({ bookingId, listingId }: { bookingId: string; listingId: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return setError("Choose a rating");
    setBusy(true);
    setError(null);
    const res = await callApi("/api/reviews", "POST", { booking_id: bookingId, rating, comment });
    if (res.error) {
      setBusy(false);
      return setError(res.error);
    }
    router.push(`/listings/${listingId}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid max-w-xl gap-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Rating</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              aria-label={`${n} star${n === 1 ? "" : "s"} — ${LABELS[n - 1]}`}
              aria-pressed={rating === n}
              className={`text-3xl leading-none ${n <= rating ? "text-amber-500" : "text-neutral-300 dark:text-neutral-700"}`}
            >
              ★
            </button>
          ))}
        </div>
        <p className="mt-1 h-5 text-sm text-neutral-500">{rating ? LABELS[rating - 1] : ""}</p>
      </fieldset>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Comment (optional)</span>
        <textarea
          rows={4}
          maxLength={2000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="How was the item and the handover?"
          className={inputClass}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <div>
        <button type="submit" disabled={busy} className={btn.primary}>
          {busy ? "Posting…" : "Post review"}
        </button>
      </div>
      <p className="text-xs text-neutral-500">Reviews are public, show your name, and can&apos;t be edited later.</p>
    </form>
  );
}
