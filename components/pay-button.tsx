"use client";

import { useState } from "react";
import { callApi } from "@/lib/client-api";
import { btn } from "@/components/ui";

// POST /api/bookings/:id/pay → redirect to Stripe Checkout.
export function PayButton({ bookingId, label }: { bookingId: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    const res = await callApi<{ url: string }>(`/api/bookings/${bookingId}/pay`, "POST");
    if (res.error) {
      setBusy(false);
      setError(res.error === "Payment window closed" ? "The payment window for this booking has closed." : res.error);
      return;
    }
    window.location.assign(res.data.url);
  }

  return (
    <div>
      <button type="button" className={btn.primary} disabled={busy} onClick={pay}>
        {busy ? "Opening checkout…" : label}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
