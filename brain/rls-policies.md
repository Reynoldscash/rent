# Row Level Security Policies
These policies apply to all tables in the Rent Anything / Easy Rent database.
Claude must enforce these rules exactly and must not weaken or bypass them.

All policies assume:
- profiles.id = auth.users.id
- renters must be verified to request bookings or send messages
- owners may ban renters
- sensitive fields are controlled by triggers, not clients
- "system" = triggers, SECURITY DEFINER functions, scheduled jobs, and server code using the service role (see database-schema.md)

---

# PROFILES

## profiles
### Select
- Users can select their own profile.
- Users can select other profiles only for:
  - listing owners
  - booking participants
  - message participants
- Reviewer names are exposed publicly only through the `public_reviews` view, not by opening `profiles`.

### Insert
- Only system can insert (auto-created at signup).

### Update
- Users can update:
  - full_name
  - avatar_url
- Users cannot update:
  - id
  - is_verified
- System updates is_verified based on email confirmation.

---

# LISTINGS

## listings
### Select
- Anyone can read active listings.
- Owners can read their own inactive listings.

### Insert
- Only verified users can create listings.
- owner_id must equal auth.uid().

### Update
- Only the owner can update their listing.
- Owner cannot change owner_id.

### Delete
- Only the owner, and only if no bookings exist for that listing (any status).
- Otherwise the owner sets status = 'inactive'.

---

# LISTING IMAGES

## listing_images
### Select
- Anyone can read images for active listings.
- Owners can read images for their inactive listings.

### Insert / Update / Delete
- Only owner of the listing.

---

# AVAILABILITY BLOCKS

## availability_blocks
### Select
- Anyone can read blocks for active listings.
- Owners can read blocks for their own listings.

### Insert
- Owner: only rows with source = 'manual' on listings they own (booking_id must be null).
- System: rows with source = 'booking' (when a booking is approved).

### Update
- No client updates. (Owners delete and re-create manual blocks.)

### Delete
- Owner: only rows with source = 'manual' on listings they own.
- System: rows with source = 'booking' (when that booking is cancelled for any reason).

### Constraints
- Overlapping blocks (manual or booking) on the same listing are rejected by a Postgres exclusion constraint.

---

# BOOKINGS

## bookings
### Select
- Renter can read their own bookings.
- Owner can read bookings for their listings.

### Insert
Allowed only if:
- renter_id = auth.uid()
- renter is verified
- renter is not banned by owner
- listing is active
- renter is not the owner
- dates do not overlap any availability block
- start_date < end_date
- start_date >= today

System sets:
- owner_id
- total_price
- status = 'pending'

### Update
Clients can only change `status`, and only these transitions:
- Renter:
  - pending → cancelled
  - approved → cancelled
- Owner:
  - pending → approved
  - pending → rejected
  - pending → cancelled
  - approved → cancelled

Owner cancelling a paid booking goes through a server-side (system) function, not a direct client update.

System can:
- set status = 'paid' (Stripe webhook)
- set status = 'completed' (scheduled job)
- set status = 'cancelled' from approved (payment window expiry) or paid (owner request / manual refund)
- set status = 'rejected' (auto-reject overlapping pending requests on approval)
- set approved_at
- create and remove booking blocks

Clients cannot:
- set total_price
- set owner_id
- set approved_at
- change dates, listing, or renter after insert
- make any status transition not listed above

### Delete
- No client deletes bookings.

---

# MESSAGES

## messages
### Select
- Only booking participants.

### Insert
Allowed only if:
- booking exists
- sender_id = auth.uid()
- sender is renter or owner of that booking
- renter is verified
- renter is not banned by the owner
- booking is not cancelled or rejected

### Update / Delete
- No client updates or deletes messages.

---

# REVIEWS

## reviews
### Select
- Public, through the `public_reviews` view (includes reviewer_name, excludes renter_id).
- Renters can read their own rows in `reviews`.

### Insert
Allowed only if:
- booking.status = 'completed'
- booking.renter_id = auth.uid()
- no existing review for that booking (unique constraint)

System sets:
- listing_id from booking

### Update / Delete
- No client updates or deletes reviews.

---

# OWNER BANS

## owner_bans
### Select
- Only owner can see their ban list.

### Insert
Allowed only if:
- owner_id = auth.uid()
- a booking exists between owner and banned_user_id

### Delete
- Only owner.

### Effects
- Booking creation checks this table (via SECURITY DEFINER function).
- Messaging checks this table (via SECURITY DEFINER function).
- Renter never sees ban reason or existence.

---

# PAYMENTS

## payments
### Select
- Only booking participants.

### Insert / Update
- Only system (Stripe webhook, cancellation of paid bookings).

### Delete
- No client deletes payments.

---

# STORAGE BUCKETS

## listing-images
- Public read.
- Owner write.

## avatars
- Public read.
- Users can write only their own avatar.

---

# FINAL NOTES
- All sensitive fields (status, total_price, owner_id, approved_at, is_verified) are protected by triggers.
- All booking transitions are validated by RLS + triggers.
- Manual blocks and booking blocks both prevent booking requests and approvals.
- Verification is required for booking requests and messaging.
