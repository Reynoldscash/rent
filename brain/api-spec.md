# API Specification — Rent Anything / Easy Rent
This document defines every API route the frontend may call.
All routes follow the rules in:

- `database-schema.md`
- `rls-policies.md`
- `booking-flow.md`
- `implementation-notes.md`
- `frontend-structure.md`

Normal API routes run as the signed-in user (using their Supabase JWT), so RLS and all database rules still apply.
The service role key is used only for true "system" operations:
- the Stripe webhook (`POST /api/payments/webhook`)
- recording the Checkout session inside `POST /api/bookings/:id/pay`

The browser never sets sensitive fields (status, owner_id, total_price, is_verified).
All responses use JSON.

---

## 1. Auth & Profile

### GET /api/me
Returns the authenticated user's profile.
Auth: required
Returns:
```json
{
  "id": "uuid",
  "full_name": "string",
  "avatar_url": "string",
  "is_verified": true
}
```

### PATCH /api/me
Update profile fields.
Auth: required
Allowed fields:
- `full_name`
- `avatar_url` (the browser uploads the file to the `avatars` bucket first, then saves its URL here)

Returns: updated profile.

### GET /api/me/listings
The signed-in user's own listings (active and inactive).
Auth: required

### GET /api/me/bookings
Bookings the signed-in user takes part in.
Auth: required
Query params:
- `role` = `renter` | `owner` (default `renter`)
- `status` (optional, comma-separated, e.g. `pending,approved`)

Owner incoming requests: `GET /api/me/bookings?role=owner&status=pending,approved`.

### GET /api/me/bans
The signed-in owner's ban list.
Auth: required

---

## 2. Listings & Categories

### GET /api/categories
Public list of categories (`id`, `name`, `slug`).

### GET /api/listings
Public listing search.
Query params:
- `q` (text search on title and description)
- `category` (category slug)
- `location` (text match)

Returns: array of active listings (with first image and rating).

### GET /api/listings/:id
Public listing detail.
Includes:
- listing fields
- category
- owner name and avatar
- images
- aggregated rating
- public reviews (via `public_reviews` view)
- blocked date ranges (from `availability_blocks`, current and future), so the date picker can grey out unavailable dates

### POST /api/listings
Create a listing.
Auth: required (verified)
Body:
```json
{
  "title": "string",
  "description": "string",
  "category_id": "uuid",
  "price_per_day": 25,
  "location": "string"
}
```
Returns: listing.

Images are added afterwards (see below), because storage paths use the listing id.

### PATCH /api/listings/:id
Update listing.
Auth: owner only
Allowed fields:
- title
- description
- category_id
- price_per_day
- location
- status (active/inactive)

### DELETE /api/listings/:id
Delete listing only if no bookings exist.
Auth: owner only
If bookings exist: return error:
```
"Cannot delete listing with booking history. Set status to inactive instead."
```

### Listing images (three-step flow)
1. Create the listing (`POST /api/listings`).
2. The browser uploads each file directly to storage: `listing-images/<listing_id>/<file>` (storage policies allow only the owner).
3. Save the record:

#### POST /api/listings/:id/images
Auth: owner only
Body: `{ "image_url": "string" }`
Returns: image.

#### DELETE /api/listings/:id/images/:imageId
Auth: owner only
Removes the image record (and the stored file).

---

## 3. Availability Blocks (Manual)

### POST /api/listings/:id/blocks
Create manual block.
Auth: owner only
Body:
```json
{
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD"
}
```
Returns: block.

### DELETE /api/blocks/:blockId
Remove manual block.
Auth: owner only
Booking blocks cannot be deleted by owner.

---

## 4. Bookings

### POST /api/bookings
Create booking request.
Auth: renter must be verified
Body:
```json
{
  "listing_id": "uuid",
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD"
}
```
System sets:
- owner_id
- total_price
- status = pending

Errors:
- "Listing inactive"
- "Cannot book your own listing"
- "Dates unavailable"
- "You must verify your email to request a booking"
- "This booking cannot be created" (ban)

### GET /api/bookings/:id
Booking detail.
Auth: renter or owner of booking.

### PATCH /api/bookings/:id/approve
Owner approves booking.
Auth: owner
System:
- sets status = approved
- sets approved_at
- creates booking block
- auto-rejects overlapping pending requests

### PATCH /api/bookings/:id/reject
Owner rejects pending booking.
Auth: owner
System: sets status = rejected.

### PATCH /api/bookings/:id/cancel
Cancel booking.
Auth: renter or owner
Rules:
- renter: pending → cancelled
- renter: approved → cancelled
- owner: pending/approved → cancelled
- owner: paid → cancelled (via `owner_cancel_paid_booking` database function)

System:
- removes block
- if paid: sets needs_refund = true

---

## 5. Payments

Server-only environment variables: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. Use Stripe test mode until launch.

### POST /api/bookings/:id/pay
Start Stripe Checkout.
Auth: renter
System:
- checks payment window:
  - if < 30 minutes left → return: "Payment window closed"
- creates Stripe Checkout session (expires at the end of the payment window)
  - success URL: `/bookings/:id?payment=success`
  - cancel URL: `/bookings/:id?payment=cancelled`
- records the session with `record_checkout_session` (service role)
- returns session URL

### POST /api/payments/webhook
Stripe webhook endpoint.
Auth: none (Stripe only)
System (service role):
- validates signature
- calls `apply_stripe_payment`, which:
  - updates payments table
  - if booking was approved: sets status = paid
  - if booking was cancelled: sets needs_refund = true

---

## 6. Messaging

### GET /api/messages/threads
List message threads.
Auth: required
Returns: threads for bookings where user is participant.

### GET /api/messages/:bookingId
Messages for a booking.
Auth: participant only.

### POST /api/messages/:bookingId
Send message.
Auth: participant
System checks:
- booking exists
- renter verified
- renter not banned (a ban closes the thread for both sides)
- booking not cancelled/rejected

If blocked: "This booking cannot be updated at this time"

---

## 7. Reviews

### POST /api/reviews
Create review.
Auth: renter
Body:
```json
{
  "booking_id": "uuid",
  "rating": 5,
  "comment": "Great experience!"
}
```
System:
- ensures booking.status = completed
- ensures renter_id matches booking
- ensures no existing review for booking
- sets listing_id automatically

### GET /api/listings/:id/reviews
Public reviews.
Uses `public_reviews` view.

---

## 8. Bans

### POST /api/bans
Owner bans renter.
Auth: owner
Body:
```json
{
  "banned_user_id": "uuid",
  "reason": "optional"
}
```
System:
- ensures booking exists between them
- ensures ban doesn't already exist

### DELETE /api/bans/:id
Owner unbans renter.

---

## 9. System Jobs (pg_cron)

### cron: easy-rent-expire-unpaid-approvals
Runs every 10 minutes.
Logic:
- find bookings:
  - status = approved
  - approved_at older than payment window
  - no successful payment
- set status = cancelled
- remove block

### cron: easy-rent-complete-finished-bookings
Runs hourly.
Logic:
- find bookings:
  - status = paid
  - end_date < today (Central Time)
- set status = completed

---

## 10. Error Format
All errors follow:
```json
{
  "error": "Message here"
}
```
Common messages:
- "Listing inactive"
- "Dates unavailable"
- "Payment window closed"
- "You must verify your email to request a booking"
- "This booking cannot be updated at this time"
- "Cannot delete listing with booking history. Set status to inactive instead."
- "This booking cannot be created" (ban)

---

## 11. Notes for Claude
Claude must:
- never allow client to set sensitive fields
- run normal routes as the signed-in user; use the service role only for the system operations listed at the top
- follow booking-flow.md exactly
- follow rls-policies.md exactly
- use implementation-notes.md for function names and storage paths
- never invent new endpoints without updating this file
