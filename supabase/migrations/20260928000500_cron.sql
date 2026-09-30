-- =============================================================================
-- Easy Rent — 0005: scheduled jobs (pg_cron)
-- Source of truth: brain/booking-flow.md §3 and §6
-- =============================================================================

create extension if not exists pg_cron;

-- Cancel approved bookings not paid within the payment window (24h).
select cron.schedule(
  'easy-rent-expire-unpaid-approvals',
  '*/10 * * * *',
  $$select public.expire_unpaid_approvals();$$
);

-- Mark paid bookings completed once end_date has passed (America/Chicago).
select cron.schedule(
  'easy-rent-complete-finished-bookings',
  '5 * * * *',
  $$select public.complete_finished_bookings();$$
);
