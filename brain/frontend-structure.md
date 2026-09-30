# Frontend Structure — Rent Anything / Easy Rent

This document defines the Next.js app structure: pages, layouts, route protection, and how each page talks to the backend. It assumes:

- Next.js (App Router, TypeScript)
- Supabase with @supabase/ssr
- Auth + email confirmation already implemented
- Protected routes currently: /dashboard, /bookings, /messages, /listings/new
- Pages load data through the endpoints in `api-spec.md` (or the same server-side data functions those endpoints use — see implementation-notes.md)

---

## 1. Global Layout

### 1.1 Root Layout
- File: `app/layout.tsx`
- Responsibilities:
  - Global header (logo, navigation, auth state)
  - Global footer
  - Theme (system light/dark, no toggle yet)
  - Supabase client provider (if needed)
  - Session context (if needed)

### 1.2 Header
- Shows:
  - Logo / brand name
  - Links:
    - Home (`/`)
    - Browse listings (`/listings`)
    - Dashboard (`/dashboard`) — if signed in
  - Auth controls:
    - Sign in / Sign up (if signed out)
    - Account menu (if signed in): email, Dashboard, Profile (`/dashboard/profile`), Sign out

---

## 2. Auth & Account Pages

### 2.1 Sign Up
- Route: `/signup`
- Behavior:
  - Email + password sign-up
  - On success:
    - Supabase sends confirmation email
    - User sees "Check your email to confirm your account" on `/signup` itself (no separate page)

### 2.2 Sign In
- Route: `/signin`
- Behavior:
  - Email + password sign-in
  - On success:
    - Redirect to `/dashboard` (or back to the protected page that sent them to sign in)
  - Errors are shown on `/signin` itself (no separate error page)

### 2.3 Email Confirmation
- Route: `/auth/callback` (Supabase "Confirm signup" template links here with `token_hash` and `type`)
- Behavior:
  - Supabase confirmation link lands here
  - Page:
    - Calls Supabase to finalize confirmation
    - Ensures `is_verified` is set
    - Redirects to `/dashboard`, which shows the success message
    - On failure: redirects to `/signin` with the error

### 2.4 Sign Out
- Triggered from header/account menu
- Behavior:
  - Calls Supabase sign-out
  - Redirects to `/`

---

## 3. Route Protection

### 3.1 Proxy / Middleware
- File: `proxy.ts` (Next.js 16)
- Uses:
  - `lib/auth/routes.ts` to define protected routes
- Protected routes:
  - `/dashboard`
  - `/bookings`
  - `/messages`
  - `/listings/new`
- Behavior:
  - If not signed in → redirect to `/signin`
  - No verification redirect: with "Confirm email" on, Supabase does not let unconfirmed users sign in, so signed-in users are verified. Pages still show the inline message in 9.2 if `is_verified` is false.

---

## 4. Core Pages

### 4.1 Home
- Route: `/`
- Purpose:
  - Landing page
  - Explains the product
  - Links to:
    - Browse listings
    - Sign up / Sign in
- Data:
  - None required for MVP (static content is fine)

### 4.2 Browse Listings
- Route: `/listings`
- Purpose:
  - Show searchable/filterable list of active listings
- Data:
  - GET `/api/listings`
  - GET `/api/categories` (filter options)
- Features:
  - Search by text
  - Filter by category
  - Filter by location
  - Click to view listing detail

### 4.3 Listing Detail
- Route: `/listings/[id]`
- Purpose:
  - Show a single listing:
    - title
    - description
    - price_per_day
    - location
    - owner avatar
    - images
    - reviews (via `public_reviews` view)
- Data:
  - GET `/api/listings/[id]` (includes blocked date ranges)
  - GET `/api/listings/[id]/reviews`
- Actions:
  - If signed in & verified:
    - Inline booking request form: calendar with blocked dates greyed out, price preview, submit → POST `/api/bookings`
  - If not signed in:
    - "Sign in to request a booking" (→ `/signin`, returning here)
  - If the viewer is the owner:
    - "This is your listing" + link to `/dashboard/listings/[id]`

### 4.4 New Listing
- Route: `/listings/new` (protected)
- Purpose:
  - Owner creates a new listing
- Data:
  - GET `/api/categories`
  - POST `/api/listings`
  - then images (three-step flow in `api-spec.md`): upload to `listing-images/<listing_id>/…`, then POST `/api/listings/[id]/images`
- Fields:
  - title
  - description
  - category
  - price_per_day
  - location
  - images

---

## 5. Dashboard & Booking Pages

### 5.1 Dashboard
- Route: `/dashboard` (protected)
- Purpose:
  - Overview for signed-in user
- Data:
  - GET `/api/me`
  - GET `/api/me/listings`
  - GET `/api/me/bookings?role=renter`
  - GET `/api/me/bookings?role=owner&status=pending,approved`
- Sections:
  - My listings (owner)
  - My bookings (renter)
  - Verification status
  - Incoming requests count (links to `/dashboard/requests`)
  - Shows "Email confirmed" notice after `/auth/callback`

### 5.2 My Bookings
- Route: `/bookings` (protected)
- Purpose:
  - Show bookings where user is renter
- Data:
  - GET `/api/me/bookings?role=renter`
- Actions:
  - Cancel pending/approved bookings (per rules)
  - View booking detail
  - Open messages

### 5.3 Booking Detail
- Route: `/bookings/[id]` (protected)
- Purpose:
  - Show single booking:
    - listing info
    - dates
    - status
    - total_price
    - payment status
- Data:
  - GET `/api/bookings/[id]`
- Actions:
  - If status = `pending` or `approved`:
    - Cancel (if allowed)
  - If status = `approved`:
    - "Pay now" → POST `/api/bookings/[id]/pay` → Stripe Checkout
  - Stripe returns here with `?payment=success` or `?payment=cancelled`; show "Payment received" or "Payment cancelled"
  - Owner viewing a paid booking: "Cancel booking" (refund handled manually)
  - If status = `completed`:
    - "Leave review" (if not already reviewed)

---

## 6. Messaging

### 6.1 Messages List
- Route: `/messages` (protected)
- Purpose:
  - Show all booking threads where user is participant
- Data:
  - GET `/api/messages/threads`
- Each thread:
  - booking summary
  - last message preview
  - status (open/closed)

### 6.2 Message Thread
- Route: `/messages/[bookingId]` (protected)
- Purpose:
  - Show messages for a single booking
- Data:
  - GET `/api/messages/[bookingId]`
  - POST `/api/messages/[bookingId]`
  - Realtime subscription on `messages` for live updates
- Actions:
  - Send message (if:
    - booking exists
    - user is participant
    - user is verified
    - user is not banned
    - booking not cancelled/rejected)
- If banned or booking closed:
  - Show neutral message:
    - "This booking cannot be updated at this time."
  - Disable input

---

## 7. Reviews

### 7.1 Leave Review
- Route: `/bookings/[id]/review` (protected)
- Purpose:
  - Renter leaves review for completed booking
- Data:
  - GET `/api/bookings/[id]` (to confirm status = `completed`)
  - POST `/api/reviews`
- Fields:
  - rating (1–5)
  - comment
- After submit:
  - Redirect to listing detail or booking detail

---

## 8. Owner Tools

### 8.1 My Listings
- Route: `/dashboard/listings` (could be a section of `/dashboard`)
- Purpose:
  - Owner manages listings
- Data:
  - GET `/api/me/listings`
- Actions:
  - Edit listing
  - Set active/inactive
  - View bookings per listing

### 8.2 Incoming Requests
- Route: `/dashboard/requests` (protected)
- Purpose:
  - Owner sees bookings on their listings
- Data:
  - GET `/api/me/bookings?role=owner` (filter by status)
- Actions:
  - Approve (PATCH `/api/bookings/[id]/approve`)
  - Reject (PATCH `/api/bookings/[id]/reject`)
  - Cancel (PATCH `/api/bookings/[id]/cancel`, including paid bookings)
  - Ban renter (POST `/api/bans`)
  - Open messages

### 8.3 Edit Listing
- Route: `/dashboard/listings/[id]` (protected)
- Purpose:
  - Owner edits one listing
- Data:
  - GET `/api/listings/[id]`
  - PATCH `/api/listings/[id]`
  - DELETE `/api/listings/[id]` (only if no bookings)
  - POST / DELETE `/api/listings/[id]/images`
  - POST `/api/listings/[id]/blocks`, DELETE `/api/blocks/[blockId]`
- Sections:
  - Listing fields + active/inactive
  - Images
  - Manual blocked dates

### 8.4 Profile
- Route: `/dashboard/profile` (protected)
- Data:
  - GET `/api/me`
  - PATCH `/api/me`
- Fields:
  - full name
  - avatar (upload to `avatars/<user_id>/…`, then save URL)

### 8.5 Ban Management
- Route: `/dashboard/bans` (protected)
- Purpose:
  - Owner sees their ban list
- Data:
  - GET `/api/me/bans`
  - DELETE `/api/bans/[id]`
- Actions:
  - Unban renter

---

## 9. Error & Status Pages

### 9.1 Payment Window Closed
- Trigger:
  - Renter tries to start Stripe Checkout in last 30 minutes of 24-hour window
- Behavior:
  - Show page or inline message:
    - "The payment window for this booking has closed."

### 9.2 Verification Required
- Trigger:
  - Unverified user tries to:
    - request booking
    - send messages
- Behavior:
  - Show message:
    - "Verify your email to continue."
  - Link to email confirmation instructions

---

## 10. Implementation Notes (Frontend)

- Supabase client:
  - Use `@supabase/ssr` as you already did.
- Route protection:
  - Centralized in `proxy.ts` + `lib/auth/routes.ts`.
- Env vars:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key)
  - `SUPABASE_SERVICE_ROLE_KEY` (server only)
  - `NEXT_PUBLIC_SITE_URL`
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (server only)
- Theme:
  - Follows system light/dark; toggle can be added later.

---

Claude must use this structure when generating pages, components, and API calls. No new routes or pages should be invented without updating this file first.
