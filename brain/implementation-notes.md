# Implementation Notes — Database
Records how `database-schema.md`, `rls-policies.md` and `booking-flow.md` are implemented in `supabase/migrations`. Claude must keep this file in sync with the migrations. It adds no new features; it names the concrete pieces.

---

## Migrations

| File | Contents |
|---|---|
| `20260928000100_tables.sql` | Tables, check/exclusion constraints, indexes, `updated_at` triggers |
| `20260928000200_logic.sql` | Triggers, functions, read-model views |
| `20260928000300_rls.sql` | Column grants, RLS policies, realtime publication |
| `20260928000400_storage.sql` | `listing-images` and `avatars` buckets + policies |
| `20260928000500_cron.sql` | pg_cron schedules |

Enable the **pg_cron** extension in the Supabase dashboard before applying `…0500_cron.sql`.

---

## How "system vs client" is enforced
- **Column grants**: clients can only write specific columns (e.g. bookings: insert `listing_id, start_date, end_date`; update `status` only). Everything else is rejected with "permission denied".
- **RLS**: decides which rows a client can see or touch.
- **Triggers** (security invoker): force system fields (`owner_id`, `renter_id`, `sender_id`, `total_price`, `status` on insert, `approved_at`, review `listing_id`) and validate status transitions. `public.is_client()` is true when the caller is `anon`/`authenticated`.
- **`private` schema**: SECURITY DEFINER helpers (ban checks, block checks, side effects). Not exposed through the Supabase API.

---

## Functions callable from the app

| Function | Caller | Purpose |
|---|---|---|
| `calculate_total_price(listing_id, start, end)` | anyone | Price preview (same formula the trigger uses) |
| `owner_cancel_paid_booking(booking_id)` | owner (authenticated) | Cancels a paid booking; releases block; flags refund |
| `record_checkout_session(booking_id, session_id, amount_cents)` | service role | Store a new Stripe Checkout session; checks booking is approved and amount matches |
| `apply_stripe_payment(session_id, booking_id, payment_intent, amount_cents, status)` | service role (webhook) | Idempotent. `paid` + approved → booking paid. `paid` + not approved (late/duplicate) → `needs_refund = true` |
| `expire_unpaid_approvals()` | cron | Cancels approved bookings older than `payment_window()` (24h) with no paid payment |
| `complete_finished_bookings()` | cron | paid → completed when `end_date < market_today()` (America/Chicago) |
| `payment_window()` | anyone | Returns `24 hours`; use it for the Stripe session `expires_at` |

---

## Read models (views)
- `public_reviews` — reviews + `reviewer_name`, no `renter_id`. Public.
- `listing_ratings` — `listing_id, review_count, average_rating`. Public.
- `owner_ratings` — `owner_id, review_count, average_rating`. Public.

---

## Error messages raised to clients
- "This booking cannot be created." (banned renter — neutral)
- "This booking cannot be updated at this time." (messaging blocked — neutral)
- "This listing is not available for booking."
- "You cannot book your own listing."
- "Please verify your email before requesting a booking."
- "The end date must be after the start date."
- "The start date cannot be in the past."
- "Those dates are not available." (request overlaps a block)
- "Those dates are no longer available." (approval overlaps a block)
- "You are not allowed to make this change." (disallowed status change)
- "You can only review a completed booking you rented."

---

## Storage paths
- `listing-images/<listing_id>/<file>` — only that listing's owner can write.
- `avatars/<user_id>/<file>` — only that user can write.

---

## Realtime
`messages` and `bookings` are added to the `supabase_realtime` publication. RLS applies to realtime subscriptions.

---

## Tests
`supabase/tests/scenario_test.py` runs against a local Postgres loaded with `supabase/tests/mock_supabase.sql` (a minimal stand-in for Supabase's auth, storage and roles) plus migrations 0100–0400. It covers signup/verification, listings, bookings and every status transition, blocks, messaging, bans, payments, jobs, reviews, deletes and storage.
