# Database Schema
This document defines all database tables, columns, relationships, constraints, and rules for the Rent Anything / Easy Rent marketplace. Claude must read and follow this schema before writing or modifying any code.

All tables use:
- UUID primary keys
- created_at / updated_at timestamptz
- Supabase Row Level Security (defined in rls-policies.md)

Auth is handled by Supabase Auth (`auth.users`).
The app never stores passwords.

"System" in these docs means: database triggers, SECURITY DEFINER functions, scheduled jobs (pg_cron), and server-side code using the Supabase service role (e.g. the Stripe webhook). Clients never act as "system".

---

# AUTH & PROFILES

## profiles
App-level user profile, linked to Supabase Auth.

Columns:
- id (uuid, pk, fk → auth.users.id)
- full_name (text)
- avatar_url (text)
- is_verified (boolean, default false)
- created_at (timestamptz)
- updated_at (timestamptz)

Rules:
- Email lives in `auth.users`.
- A profile row is created automatically by a trigger when a user signs up.
- `is_verified` is set only by the system, from Supabase email confirmation (`auth.users.email_confirmed_at`), or by an admin process.
- Clients cannot update `is_verified` directly (enforced by RLS + trigger).

---

# CATEGORIES

## categories
Listing categories.

Columns:
- id (uuid, pk)
- name (text, unique)
- slug (text, unique)
- created_at (timestamptz)
- updated_at (timestamptz)

---

# LISTINGS

## listings
Items available for rent.

Columns:
- id (uuid, pk)
- owner_id (uuid, fk → profiles.id)
- category_id (uuid, fk → categories.id, nullable)
- title (text)
- description (text)
- price_per_day (numeric, check > 0) — USD
- location (text)
- status (text: 'active', 'inactive')
- created_at (timestamptz)
- updated_at (timestamptz)

Indexes:
- owner_id
- category_id
- price_per_day
- location
- status

Rules:
- Only `active` listings can be booked.
- A listing with any bookings (any status, past or future) cannot be deleted. Owners set `status = 'inactive'` instead.
- Listings with no bookings may be deleted by their owner.

---

## listing_images
Images for listings.

Columns:
- id (uuid, pk)
- listing_id (uuid, fk → listings.id)
- image_url (text)
- created_at (timestamptz)
- updated_at (timestamptz)

Notes:
- Stored in the Supabase Storage bucket `listing-images`.

---

# AVAILABILITY

## availability_blocks
Blocks dates for listings.

Used for:
- automatic blocking when a booking is approved (kept while paid)
- manual blocking by owners

Columns:
- id (uuid, pk)
- listing_id (uuid, fk → listings.id)
- start_date (date)
- end_date (date)
- source (text: 'booking' or 'manual')
- booking_id (uuid, fk → bookings.id, nullable; required when source = 'booking', null when source = 'manual')
- created_at (timestamptz)
- updated_at (timestamptz)

Rules:
- A Postgres exclusion constraint rejects overlapping ranges for **all** blocks on the same listing_id (manual and booking alike).
- start_date < end_date.
- End date is **exclusive**:
  - A rental from 1st–3rd is 2 days (1st and 2nd).
- Booking blocks (`source = 'booking'`) are created and removed only by the system:
  - created when a booking is approved
  - removed when that booking is cancelled (for any reason)
- Manual blocks (`source = 'manual'`) are created and removed by the listing owner.

---

# BOOKINGS

## bookings
Booking requests and confirmed rentals.

Columns:
- id (uuid, pk)
- listing_id (uuid, fk → listings.id)
- renter_id (uuid, fk → profiles.id)
- owner_id (uuid, fk → profiles.id)
- start_date (date)
- end_date (date, exclusive)
- status (text: 'pending', 'approved', 'paid', 'rejected', 'cancelled', 'completed')
- total_price (numeric) — USD
- approved_at (timestamptz, nullable)
- created_at (timestamptz)
- updated_at (timestamptz)

Rules:
- `owner_id` is set by a trigger from `listings.owner_id` at insert.
- `total_price` is set by a trigger that calls `calculate_total_price(listing_id, start_date, end_date)`.
- `status` is forced to `'pending'` at insert.
- `approved_at` is set by the system when status becomes `approved`.
- Clients cannot set or override `owner_id`, `total_price`, `approved_at`, or make any status change not listed below.

Status transitions (who may make each change):

| From | To | Who |
|---|---|---|
| pending | approved | owner |
| pending | rejected | owner; system (auto-reject of overlapping requests) |
| pending | cancelled | renter, owner |
| approved | cancelled | renter, owner; system (payment window expired) |
| approved | paid | system (Stripe webhook) |
| paid | cancelled | system only — triggered by the owner through a server-side function, or by a manual refund process |
| paid | completed | system (scheduled job) |

- Renters cannot cancel paid bookings; they must contact the owner/support.
- Any cancellation of an approved or paid booking removes its availability block.

On approval (system, same transaction):
- sets `approved_at = now()`
- creates the booking block (fails if it overlaps any existing block)
- sets every other `pending` booking on the same listing with overlapping dates to `rejected`

---

# MESSAGING

## messages
Messages inside booking threads.

Columns:
- id (uuid, pk)
- booking_id (uuid, fk → bookings.id)
- sender_id (uuid, fk → profiles.id)
- content (text)
- created_at (timestamptz)
- updated_at (timestamptz)

Rules:
- Messaging unlocks once a booking exists.
- Renter must be verified (`profiles.is_verified = true`).
- Sender must be the booking's renter or owner.
- Blocked if the renter is banned by the owner, or the booking is cancelled or rejected.
- Blocked messages return the neutral error: "This booking cannot be updated at this time."

---

# REVIEWS

## reviews
One-way reviews: renter → listing, tied to a booking.

Columns:
- id (uuid, pk)
- booking_id (uuid, fk → bookings.id, unique)
- listing_id (uuid, fk → listings.id) — set by trigger from booking
- renter_id (uuid, fk → profiles.id)
- rating (integer, check 1–5)
- comment (text)
- created_at (timestamptz)
- updated_at (timestamptz)

Rules:
- Only allowed if booking.status = 'completed' and booking.renter_id = renter_id = auth.uid().
- One review per booking.
- Listing rating is aggregated from reviews; owner rating is derived from reviews of their listings.

## public_reviews (view)
Public read model for reviews.

Columns:
- all `reviews` columns except renter_id
- reviewer_name (from `profiles.full_name`)

Notes:
- This is how reviewer names are shown publicly, without opening up the `profiles` table.

---

# OWNER BAN LIST

## owner_bans
Owners can ban renters after any booking interaction.

Columns:
- id (uuid, pk)
- owner_id (uuid, fk → profiles.id)
- banned_user_id (uuid, fk → profiles.id)
- reason (text, optional)
- created_at (timestamptz)
- updated_at (timestamptz)

Constraints:
- unique (owner_id, banned_user_id)

Rules:
- Owner can ban a renter only if a booking exists between them (any status).
- Booking creation and messaging check this table via a SECURITY DEFINER function, so renters never need (or get) read access.
- A banned renter's booking request fails with the neutral error: "This booking cannot be created."
- Renter cannot see they are banned.

---

# PAYMENTS

## payments
Stripe Checkout payment records.

Columns:
- id (uuid, pk)
- booking_id (uuid, fk → bookings.id)
- stripe_session_id (text, unique)
- stripe_payment_intent (text)
- amount_cents (integer)
- currency (text, default 'USD')
- status (text: 'pending', 'paid', 'failed')
- needs_refund (boolean, default false)
- created_at (timestamptz)
- updated_at (timestamptz)

Rules:
- Currency is USD only for MVP.
- Stripe webhooks update `status`.
- When a payment becomes 'paid' and the booking is `approved`: booking.status is set to 'paid'.
- When a payment becomes 'paid' but the booking is already `cancelled` (late payment): the payment is recorded, the booking stays cancelled, and `needs_refund = true`.
- When a paid booking is cancelled: its payment is set to `needs_refund = true`.
- Stripe Checkout sessions expire at the end of the booking's payment window.
- `stripe_session_id` is unique so repeated webhook deliveries cannot create duplicate records.
- No owner payouts in MVP; refunds are handled manually.

---

# STORAGE BUCKETS

- `listing-images` — for `listing_images.image_url`
- `avatars` — for `profiles.avatar_url`

---

# SUPPORTING FUNCTIONS & JOBS

## calculate_total_price(listing_id, start_date, end_date)
SQL function that:
- fetches `price_per_day`
- calculates number of days (end_date exclusive)
- returns `total_price`

Used by a trigger during booking creation.

---

## scheduled_completion_job
Scheduled job (pg_cron) that:
- finds bookings with status = 'paid' and end_date < today (America/Chicago)
- sets status = 'completed'

---

## approval_expiry_job
Scheduled job (pg_cron) that:
- finds bookings with status = 'approved' and approved_at + payment window (24 hours) < now()
- with no successful payment
- sets status = 'cancelled'
- removes the booking block

---

# NEXT STEPS
Claude must now use this schema to:

- generate RLS policies
- generate booking flow
- generate messaging flow
- generate review flow
- generate payment flow

All sensitive fields (status, total_price, owner_id, approved_at, is_verified) must be protected by RLS and triggers so clients cannot set them directly.
# Database Schema (Updated)

## Supplier Tiers
Enum: supplier_tier
- individual
- small_company
- large_company

users table:
- supplier_type (supplier_tier)
- company_name (text)

## Inspections
inspections table:
- id (uuid)
- booking_id (uuid → bookings)
- user_id (uuid → users)
- inspection_type ('before' | 'after')
- walkaround_video_url (text)
- serial_number (text)
- fuel_level (numeric)
- battery_level (numeric)
- accessories (text[])
- mileage_hours (numeric)
- condition_notes (text)
- created_at (timestamp)

## Claims
claims table:
- id (uuid)
- booking_id (uuid → bookings)
- owner_id (uuid → users)
- renter_id (uuid → users)
- status (text enum)
- description (text)
- evidence_urls (text[])
- repair_estimate (numeric)
- created_at (timestamp)
- updated_at (timestamp)

## Company Locations
company_locations table:
- id (uuid)
- company_id (uuid → users)
- name (text)
- address (text)
- city (text)
- state (text)
- zip (text)
- created_at (timestamp)

## Listings
listings table:
- location_id (uuid → company_locations)
