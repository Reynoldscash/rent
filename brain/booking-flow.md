# Booking Flow
This document defines the complete booking lifecycle for Rent Anything / Easy Rent.
Claude must follow this flow exactly.

All prices are USD. End dates are exclusive (1st–3rd = 2 days).

---

# 1. Renter Requests Booking
Requirements:
- renter is verified
- listing is active
- renter is not the owner
- renter is not banned
- dates do not overlap any availability block (manual or booking)
- start_date < end_date
- start_date >= today

System actions:
- set owner_id from listing
- calculate total_price via SQL function
- set status = 'pending'
- create booking record

If the renter is banned, the request fails with: "This booking cannot be created."

---

# 2. Owner Responds

## Approve
- owner sets status = 'approved'
- system, in the same transaction:
  - sets approved_at = now()
  - creates availability block (source = 'booking'); approval fails if it overlaps any block
  - sets all other pending bookings on this listing with overlapping dates to 'rejected'

## Reject
- owner sets status = 'rejected'
- no block created

---

# 3. Payment Window
- The payment window is 24 hours from approved_at.
- The Stripe Checkout session expires at the end of the window.

A scheduled job checks:
- status = 'approved'
- approved_at + 24 hours < now()
- no payment received

If expired:
- system sets status = 'cancelled'
- system removes availability block

---

# 4. Renter Pays (Stripe Checkout)
Stripe webhook:
- verifies the event signature
- records/updates the payments row (amount_cents, currency = 'USD')
- if the booking is 'approved': sets booking.status = 'paid'
- if the booking is already 'cancelled' (late payment):
  - records the payment
  - keeps the booking cancelled
  - sets payments.needs_refund = true

---

# 5. Cancellation Rules

## Renter
- can cancel pending
- can cancel approved (before payment)
- cannot cancel paid — must contact the owner/support

## Owner
- can cancel pending
- can cancel approved
- can cancel paid (through a server-side function; refund handled manually)

## System
- cancels approved bookings when the payment window expires
- cancels paid bookings when the owner requests it or a manual refund is processed
- when a paid booking is cancelled, sets payments.needs_refund = true

## Dates
- Any cancellation of an approved or paid booking removes its availability block.

---

# 6. Automatic Completion
Scheduled job:
- finds bookings where:
  - status = 'paid'
  - end_date < today (America/Chicago)
- sets status = 'completed'

Completed bookings unlock reviews.

---

# 7. Review Creation
Renter may leave one review per booking.

Requirements:
- booking.status = 'completed'
- renter_id matches booking.renter_id
- no existing review for booking

System sets:
- listing_id from booking

Reviews are shown publicly with the reviewer's name via the `public_reviews` view.

---

# 8. Messaging Rules
Messaging unlocks when booking is created.

Renter must be verified.

Messaging blocked if:
- renter is banned
- booking is cancelled or rejected

Neutral error message:
- "This booking cannot be updated at this time."

---

# 9. Ban Rules
Owner may ban renter only if:
- a booking exists between them (any status)

Ban effects:
- renter cannot request bookings from that owner
- renter cannot message that owner
- renter never sees ban reason or existence

---

# 10. Manual Blocks
Owners may manually add and remove blocks on their own listings.

Manual blocks:
- prevent booking requests
- prevent approvals
- are enforced by the same overlap constraint as booking blocks

---

# 11. Listings Lifecycle
- Only active listings can be booked.
- Listings with any bookings cannot be deleted; owners set them inactive.

---

# END OF FLOW
Claude must implement all booking logic according to this document.
