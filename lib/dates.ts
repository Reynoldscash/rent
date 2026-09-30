// Date helpers for YYYY-MM-DD strings. End dates are exclusive (booking-flow.md).
// All math is done in UTC so a "day" never shifts with the viewer's time zone.

export const MARKET_TZ = "America/Chicago";

/** Today's date in the marketplace time zone, as YYYY-MM-DD. */
export function marketToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MARKET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const d = toUtc(value);
  return !Number.isNaN(d.getTime()) && fromUtc(d) === value;
}

export function toUtc(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function fromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** Number of rental days in [start, end). */
export function daysBetween(start: string, end: string): number {
  return Math.round((toUtc(end).getTime() - toUtc(start).getTime()) / 86_400_000);
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(toUtc(iso));
}

export function formatUsd(amount: number | string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(amount));
}
