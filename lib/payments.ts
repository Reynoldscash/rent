// Payment window rules (booking-flow.md §3). Mirrors public.payment_window() in the database.
export const PAYMENT_WINDOW_MS = 24 * 60 * 60 * 1000;
// Stripe Checkout sessions must stay open at least 30 minutes.
export const MIN_CHECKOUT_MS = 30 * 60 * 1000;

export function paymentDeadline(approvedAt: string): Date {
  return new Date(new Date(approvedAt).getTime() + PAYMENT_WINDOW_MS);
}

/** True if a new Checkout session can still be created. */
export function canStartCheckout(approvedAt: string | null, now = Date.now()): boolean {
  if (!approvedAt) return false;
  return paymentDeadline(approvedAt).getTime() - now >= MIN_CHECKOUT_MS;
}

export function formatDeadline(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(d);
}
