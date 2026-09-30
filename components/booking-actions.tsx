"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { callApi } from "@/lib/client-api";
import type { BookingStatus } from "@/lib/data/bookings";
import { btn } from "@/components/ui";

type Props = {
  bookingId: string;
  status: BookingStatus;
  role: "renter" | "owner";
  renterId?: string;
  renterName?: string | null;
  renterBanned?: boolean;
};

// Buttons shown depend on booking-flow.md §5; the database enforces the rules.
export function BookingActions({ bookingId, status, role, renterId, renterName, renterBanned }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, path: string, method: "PATCH" | "POST", body?: unknown, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key);
    setError(null);
    const res = await callApi(path, method, body);
    setBusy(null);
    if (res.error) setError(res.error);
    else router.refresh();
  }

  function ban() {
    const reason = window.prompt(
      `Ban ${renterName ?? "this renter"}? They won't be able to request your listings or message you, and won't be told why.\n\nOptional private note:`,
    );
    if (reason === null) return;
    run("ban", "/api/bans", "POST", { banned_user_id: renterId, reason });
  }

  const base = `/api/bookings/${bookingId}`;
  const buttons: React.ReactNode[] = [];

  if (role === "owner") {
    if (status === "pending") {
      buttons.push(
        <button key="approve" className={btn.primary} disabled={!!busy} onClick={() => run("approve", `${base}/approve`, "PATCH")}>
          {busy === "approve" ? "Approving…" : "Approve"}
        </button>,
        <button key="reject" className={btn.secondary} disabled={!!busy} onClick={() => run("reject", `${base}/reject`, "PATCH", undefined, "Decline this request?")}>
          Decline
        </button>,
      );
    }
    if (status === "approved") {
      buttons.push(
        <button key="cancel" className={btn.danger} disabled={!!busy} onClick={() => run("cancel", `${base}/cancel`, "PATCH", undefined, "Cancel this approved booking? The dates will be released.")}>
          Cancel booking
        </button>,
      );
    }
    if (status === "paid") {
      buttons.push(
        <button key="cancel" className={btn.danger} disabled={!!busy} onClick={() => run("cancel", `${base}/cancel`, "PATCH", undefined, "Cancel this PAID booking? The dates will be released and the renter's payment will be flagged for a manual refund.")}>
          Cancel paid booking
        </button>,
      );
    }
    if (renterId && !renterBanned) {
      buttons.push(
        <button key="ban" className={btn.secondary} disabled={!!busy} onClick={ban}>
          Ban renter
        </button>,
      );
    }
  } else if (status === "pending" || status === "approved") {
    buttons.push(
      <button key="cancel" className={btn.danger} disabled={!!busy} onClick={() => run("cancel", `${base}/cancel`, "PATCH", undefined, "Cancel this booking request?")}>
        {busy === "cancel" ? "Cancelling…" : status === "pending" ? "Cancel request" : "Cancel booking"}
      </button>,
    );
  }

  if (!buttons.length && !(role === "owner" && renterBanned)) return null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {buttons}
        {role === "owner" && renterBanned && <span className="text-xs text-neutral-500">Renter banned</span>}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
