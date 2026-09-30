# Easy Rent

Rental marketplace: Next.js (App Router) + Supabase + Vercel.
Architecture and rules live in [`brain/`](brain/) — read those first.

```
brain/                 source-of-truth docs
supabase/migrations/   database schema, RLS, logic, storage, cron
supabase/tests/        scenario tests for the migrations
app/                   Next.js pages + API routes (app/api)
components/            shared UI
lib/supabase/          Supabase clients (browser, server, admin) + session proxy
proxy.ts               refreshes the session and protects routes (Next.js 16)
```

## 1. Supabase (dev project first)

1. Create a **dev** Supabase project.
2. Database → Extensions: enable **pg_cron**.
3. Apply `supabase/migrations/` in order (0100 → 0800) (Supabase CLI: `supabase link` then `supabase db push`, or paste each file into the SQL editor in order).
4. Check Database → Cron shows `easy-rent-expire-unpaid-approvals` and `easy-rent-complete-finished-bookings`.
5. Authentication → Sign In / Providers: keep **Email** on with **Confirm email** on. Turn other providers off (email/password only).
6. Authentication → URL Configuration:
   - Site URL: `http://localhost:3000` for dev (your Vercel domain for production)
   - Redirect URLs: add `http://localhost:3000/**` and `https://*.vercel.app/**`
7. Authentication → Email Templates → **Confirm signup**: set the link to
   ```
   {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email
   ```

## 2. Run locally

```bash
cp .env.example .env.local   # fill in values from Supabase → Project Settings → API
npm install
npm run dev
```

Then: sign up → confirm the email (lands on /dashboard) → browse /listings → open a listing → request a booking.

To see listings, add a few categories in the Supabase table editor (`categories`: name + slug), then create listings from the SQL editor or, once built, `/listings/new`.

## 3. Stripe (test mode)

1. Create a Stripe account and stay in **Test mode**.
2. Developers → API keys: copy the **secret key** (`sk_test_…`) into `STRIPE_SECRET_KEY`.
3. Local webhooks — install the Stripe CLI, then:
   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/payments/webhook
   ```
   Copy the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET` and restart `npm run dev`.
4. Production/preview webhooks — Stripe Dashboard → Developers → Webhooks → add endpoint
   `https://<your-domain>/api/payments/webhook` with events:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `checkout.session.expired`.
   Put that endpoint's signing secret in Vercel as `STRIPE_WEBHOOK_SECRET`.
5. Test card: `4242 4242 4242 4242`, any future expiry, any CVC.

## 4. Test the whole rental loop in the browser

Use two accounts (two browsers, or one private window): **Owner** and **Renter**.

1. Owner: Dashboard → New listing → add photos and (optionally) blocked dates.
2. Renter: open the listing → pick dates → Request booking.
3. Owner: Dashboard → Incoming requests → Approve.
4. Renter: My bookings → open the booking → Pay now → test card → back on the booking page it shows Paid.
5. Complete it: bookings complete automatically the day after the return date. To skip the wait while testing, run in the Supabase SQL editor (dev project only):
   ```sql
   update public.bookings set status = 'completed' where id = '<booking id>' and status = 'paid';
   ```
6. Renter: open the booking → Leave a review → it appears on the listing page.

## 5. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. Vercel → Add New Project → import the repo (framework: Next.js, defaults are fine).
3. Settings → Environment Variables (Production + Preview):

   | Name | Value | Exposed to browser? |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | yes |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon or publishable key | yes |
   | `SUPABASE_SERVICE_ROLE_KEY` | service role key | **no — server only** |
   | `NEXT_PUBLIC_SITE_URL` | your Vercel URL, e.g. `https://easy-rent.vercel.app` | yes |
   | `STRIPE_SECRET_KEY` | Stripe secret key (test mode) | **no — server only** |
   | `STRIPE_WEBHOOK_SECRET` | signing secret of the Vercel webhook endpoint | **no — server only** |

4. Deploy, then add the Vercel URL to Supabase's Site URL / Redirect URLs.

Never commit `.env.local` and never put the service role key in a `NEXT_PUBLIC_` variable.

## Test the database logic

```bash
# needs a local Postgres 16 with btree_gist
createdb t
psql -d t -f supabase/tests/mock_supabase.sql
for f in supabase/migrations/2026092800{01,02,03,04,06,07,08}00_*.sql; do psql -d t -v ON_ERROR_STOP=1 -f "$f"; done
python3 supabase/tests/scenario_test.py   # expects Postgres on socket /tmp, port 54329, db "t"
```
