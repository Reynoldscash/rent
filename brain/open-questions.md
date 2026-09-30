# Open Questions (Resolved)
This document records the key architectural decisions that were previously open. Claude must treat these as final and must not contradict them.

---

## 1. Payments
- Renters pay **inside the platform** using **Stripe Checkout**.
- No automated owner payouts in MVP.
- Platform receives funds; refunds are out of scope for MVP (handled manually if needed).
- A `payments` table records Stripe sessions and payment status.

---

## 2. Total Price Calculation
- Total price is calculated in a **Supabase SQL function**:
  - `calculate_total_price(listing_id, start_date, end_date)`
- A **database trigger** sets `bookings.total_price` on insert.
- Clients cannot send their own total_price.

---

## 3. Double-Booking Rules
- Approved/paid bookings automatically block dates via `availability_blocks`.
- Owners can also manually block dates.
- Pending requests may overlap.
- Overlapping approved/paid bookings are prevented by a Postgres constraint on `availability_blocks`.
- Approved bookings that are never paid expire after a set time window and are auto-cancelled; their blocks are removed.

---

## 4. Booking Statuses
Statuses:
- `pending`
- `approved`
- `paid`
- `rejected`
- `cancelled`
- `completed`

Rules:
- `completed` is set **only** for `paid` bookings when `end_date < now()` via a scheduled job.
- Reviews unlock only after `completed`.
- Status transitions are controlled by system/owner/renter as defined in `database-schema.md` and `booking-flow.md`.

---

## 5. Messaging Scope
- Messaging is allowed **only inside booking threads**.
- Messaging unlocks after a booking request is created.
- Renter must be **verified** (`profiles.is_verified = true`) to send messages.
- Owners can reply once booking exists.
- If renter is banned, messaging is blocked with a neutral error message.

---

## 6. Reviews
- Reviews are **one-way**: renter → listing.
- Each review is tied to a **booking** (`booking_id`), with one review per booking.
- Reviews belong to the listing; owner reputation can be derived from reviews of their listings.
- Reviews are allowed only after the booking is `completed`.

---

## 7. Sign-In Methods
- MVP uses **email + password** via Supabase Auth.
- Email confirmation is used to set `profiles.is_verified`.
- Clients cannot directly change `is_verified`.

---

## Instructions for Claude
Claude must:

- Treat these decisions as final.
- Ensure all code, schema, and RLS policies align with `database-schema.md`.
- Never reintroduce password storage in app tables.
- Protect all sensitive fields (status, total_price, owner_id, is_verified) via RLS and triggers.
