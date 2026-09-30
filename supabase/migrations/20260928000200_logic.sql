-- =============================================================================
-- Easy Rent — 0002: business logic (triggers, functions, views)
-- Source of truth: brain/database-schema.md, brain/booking-flow.md
--
-- Pattern:
--   * Trigger functions are SECURITY INVOKER, so public.is_client() can tell a
--     browser client (anon/authenticated) apart from "system".
--   * Privileged reads/writes live in SECURITY DEFINER helpers in the
--     `private` schema, which is not exposed through the Supabase API.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Profiles: auto-create at signup, sync is_verified from email confirmation
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, is_verified)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email_confirmed_at is not null
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.handle_user_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.profiles set is_verified = true where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function private.handle_user_email_confirmed();

-- -----------------------------------------------------------------------------
-- Price
-- -----------------------------------------------------------------------------
create or replace function public.calculate_total_price(
  p_listing_id uuid,
  p_start_date date,
  p_end_date   date
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  -- end_date is exclusive: 1st–3rd = 2 days
  select l.price_per_day * (p_end_date - p_start_date)
  from public.listings l
  where l.id = p_listing_id;
$$;

-- -----------------------------------------------------------------------------
-- Private helpers (SECURITY DEFINER)
-- -----------------------------------------------------------------------------
create or replace function private.is_verified(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select is_verified from public.profiles where id = p_user_id), false);
$$;

create or replace function private.is_banned(p_owner_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.owner_bans
    where owner_id = p_owner_id and banned_user_id = p_user_id
  );
$$;

create or replace function private.dates_blocked(p_listing_id uuid, p_start date, p_end date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.availability_blocks
    where listing_id = p_listing_id
      and daterange(start_date, end_date, '[)') && daterange(p_start, p_end, '[)')
  );
$$;

create or replace function private.listing_owner_and_status(p_listing_id uuid)
returns table (owner_id uuid, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select owner_id, status from public.listings where id = p_listing_id;
$$;

create or replace function private.message_allowed(p_booking_id uuid, p_sender_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bookings b
    where b.id = p_booking_id
      and p_sender_id in (b.renter_id, b.owner_id)
      and b.status not in ('cancelled', 'rejected')
      and private.is_verified(b.renter_id)
      and not private.is_banned(b.owner_id, b.renter_id)
  );
$$;

create or replace function private.booking_for_review(p_booking_id uuid)
returns table (renter_id uuid, listing_id uuid, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select renter_id, listing_id, status from public.bookings where id = p_booking_id;
$$;

-- Side effects of approval: create the booking block, auto-reject overlapping
-- pending requests. Runs as system.
create or replace function private.on_booking_approved(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.bookings;
begin
  select * into b from public.bookings where id = p_booking_id;
  if b.id is null or b.status <> 'approved' then
    return;
  end if;

  begin
    insert into public.availability_blocks (listing_id, start_date, end_date, source, booking_id)
    values (b.listing_id, b.start_date, b.end_date, 'booking', b.id);
  exception when exclusion_violation then
    raise exception 'Those dates are no longer available.' using errcode = 'P0001';
  end;

  update public.bookings
  set status = 'rejected'
  where listing_id = b.listing_id
    and id <> b.id
    and status = 'pending'
    and daterange(start_date, end_date, '[)') && daterange(b.start_date, b.end_date, '[)');
end;
$$;

-- Side effects of cancelling an approved/paid booking. Runs as system.
create or replace function private.on_booking_cancelled(p_booking_id uuid, p_old_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.bookings where id = p_booking_id and status = 'cancelled') then
    return;
  end if;

  delete from public.availability_blocks where booking_id = p_booking_id;

  if p_old_status = 'paid' then
    update public.payments
    set needs_refund = true
    where booking_id = p_booking_id and status = 'paid';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- listings / owner_bans: owner_id always comes from the session
-- -----------------------------------------------------------------------------
create or replace function public.listings_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and public.is_client() then
    new.owner_id := auth.uid();
  elsif tg_op = 'UPDATE' then
    new.owner_id := old.owner_id;
  end if;
  return new;
end;
$$;

create trigger listings_before_write
  before insert or update on public.listings
  for each row execute function public.listings_before_write();

create or replace function public.owner_bans_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_client() then
    new.owner_id := auth.uid();
  end if;
  return new;
end;
$$;

create trigger owner_bans_before_insert
  before insert on public.owner_bans
  for each row execute function public.owner_bans_before_insert();

-- -----------------------------------------------------------------------------
-- bookings: insert
-- -----------------------------------------------------------------------------
create or replace function public.bookings_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_status   text;
begin
  if public.is_client() then
    new.renter_id := auth.uid();
  end if;

  if new.renter_id is null then
    raise exception 'You must be signed in to request a booking.' using errcode = '42501';
  end if;

  select owner_id, status into v_owner_id, v_status
  from private.listing_owner_and_status(new.listing_id);

  if v_owner_id is null or v_status <> 'active' then
    raise exception 'This listing is not available for booking.' using errcode = 'P0001';
  end if;

  if v_owner_id = new.renter_id then
    raise exception 'You cannot book your own listing.' using errcode = 'P0001';
  end if;

  if private.is_banned(v_owner_id, new.renter_id) then
    -- Neutral on purpose: the renter must never learn they are banned.
    raise exception 'This booking cannot be created.' using errcode = 'P0001';
  end if;

  if not private.is_verified(new.renter_id) then
    raise exception 'Please verify your email before requesting a booking.' using errcode = 'P0001';
  end if;

  if new.start_date is null or new.end_date is null or new.start_date >= new.end_date then
    raise exception 'The end date must be after the start date.' using errcode = 'P0001';
  end if;

  if new.start_date < public.market_today() then
    raise exception 'The start date cannot be in the past.' using errcode = 'P0001';
  end if;

  if private.dates_blocked(new.listing_id, new.start_date, new.end_date) then
    raise exception 'Those dates are not available.' using errcode = 'P0001';
  end if;

  -- System-controlled fields
  new.owner_id    := v_owner_id;
  new.total_price := public.calculate_total_price(new.listing_id, new.start_date, new.end_date);
  new.status      := 'pending';
  new.approved_at := null;

  return new;
end;
$$;

create trigger bookings_before_insert
  before insert on public.bookings
  for each row execute function public.bookings_before_insert();

-- -----------------------------------------------------------------------------
-- bookings: status transitions
-- -----------------------------------------------------------------------------
create or replace function public.bookings_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_move text := old.status || '>' || new.status;
  v_uid  uuid := auth.uid();
begin
  -- Only status (and system-managed approved_at) may change after insert.
  if (new.listing_id, new.renter_id, new.owner_id, new.start_date, new.end_date, new.total_price, new.created_at)
     is distinct from
     (old.listing_id, old.renter_id, old.owner_id, old.start_date, old.end_date, old.total_price, old.created_at)
  then
    raise exception 'Booking details cannot be changed.' using errcode = '42501';
  end if;

  if public.is_client() and new.approved_at is distinct from old.approved_at then
    raise exception 'Booking details cannot be changed.' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    -- Every transition that exists at all (booking-flow.md / database-schema.md)
    if v_move not in (
      'pending>approved', 'pending>rejected', 'pending>cancelled',
      'approved>cancelled', 'approved>paid',
      'paid>cancelled', 'paid>completed'
    ) then
      raise exception 'A booking cannot move from % to %.', old.status, new.status using errcode = 'P0001';
    end if;

    -- Transitions a browser client may make directly
    if public.is_client() then
      if not (
        (v_uid = old.renter_id and v_move in ('pending>cancelled', 'approved>cancelled'))
        or
        (v_uid = old.owner_id and v_move in ('pending>approved', 'pending>rejected',
                                             'pending>cancelled', 'approved>cancelled'))
      ) then
        raise exception 'You are not allowed to make this change.' using errcode = '42501';
      end if;
    end if;

    if new.status = 'approved' then
      new.approved_at := now();
    end if;
  end if;

  return new;
end;
$$;

create trigger bookings_before_update
  before update on public.bookings
  for each row execute function public.bookings_before_update();

create or replace function public.bookings_after_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'approved' then
      perform private.on_booking_approved(new.id);
    elsif new.status = 'cancelled' and old.status in ('approved', 'paid') then
      perform private.on_booking_cancelled(new.id, old.status);
    end if;
  end if;
  return null;
end;
$$;

create trigger bookings_after_update
  after update on public.bookings
  for each row execute function public.bookings_after_update();

-- Owner cancels a paid booking (booking-flow.md §5). Clients cannot move a
-- booking out of 'paid' directly; this secured function does it as system.
create or replace function public.owner_cancel_paid_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.bookings;
begin
  select * into b from public.bookings where id = p_booking_id for update;

  if b.id is null or b.owner_id is distinct from auth.uid() then
    raise exception 'Booking not found.' using errcode = 'P0002';
  end if;

  if b.status <> 'paid' then
    raise exception 'Only paid bookings can be cancelled here.' using errcode = 'P0001';
  end if;

  update public.bookings set status = 'cancelled' where id = p_booking_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- messages
-- -----------------------------------------------------------------------------
create or replace function public.messages_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_client() then
    new.sender_id := auth.uid();
  end if;

  if not private.message_allowed(new.booking_id, new.sender_id) then
    raise exception 'This booking cannot be updated at this time.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger messages_before_insert
  before insert on public.messages
  for each row execute function public.messages_before_insert();

-- -----------------------------------------------------------------------------
-- reviews
-- -----------------------------------------------------------------------------
create or replace function public.reviews_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_renter_id  uuid;
  v_listing_id uuid;
  v_status     text;
begin
  if public.is_client() then
    new.renter_id := auth.uid();
  end if;

  select renter_id, listing_id, status into v_renter_id, v_listing_id, v_status
  from private.booking_for_review(new.booking_id);

  if v_renter_id is null or v_renter_id <> new.renter_id or v_status <> 'completed' then
    raise exception 'You can only review a completed booking you rented.' using errcode = 'P0001';
  end if;

  new.listing_id := v_listing_id;
  return new;
end;
$$;

create trigger reviews_before_insert
  before insert on public.reviews
  for each row execute function public.reviews_before_insert();

-- -----------------------------------------------------------------------------
-- Payments (service role only — called from the Stripe API routes)
-- -----------------------------------------------------------------------------

-- Called after the Checkout Session is created.
create or replace function public.record_checkout_session(
  p_booking_id   uuid,
  p_session_id   text,
  p_amount_cents integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.bookings;
begin
  select * into b from public.bookings where id = p_booking_id;

  if b.id is null or b.status <> 'approved' then
    raise exception 'Booking is not awaiting payment.' using errcode = 'P0001';
  end if;

  if p_amount_cents <> round(b.total_price * 100)::integer then
    raise exception 'Amount does not match booking total.' using errcode = 'P0001';
  end if;

  insert into public.payments (booking_id, stripe_session_id, amount_cents, currency, status)
  values (p_booking_id, p_session_id, p_amount_cents, 'USD', 'pending')
  on conflict (stripe_session_id) do nothing;
end;
$$;

-- Called from the Stripe webhook. Idempotent: repeated deliveries are safe.
create or replace function public.apply_stripe_payment(
  p_session_id     text,
  p_booking_id     uuid,
  p_payment_intent text,
  p_amount_cents   integer,
  p_status         text  -- 'paid' | 'failed'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.payments;
  b public.bookings;
begin
  if p_status not in ('paid', 'failed') then
    raise exception 'Unknown payment status %', p_status;
  end if;

  -- Lock the booking first so the expiry job and webhook cannot race.
  select * into b from public.bookings where id = p_booking_id for update;
  if b.id is null then
    raise exception 'Booking % not found', p_booking_id;
  end if;

  insert into public.payments (booking_id, stripe_session_id, amount_cents, currency, status)
  values (p_booking_id, p_session_id, p_amount_cents, 'USD', 'pending')
  on conflict (stripe_session_id) do nothing;

  select * into p from public.payments where stripe_session_id = p_session_id for update;

  if p.booking_id <> p_booking_id then
    raise exception 'Session % belongs to another booking', p_session_id;
  end if;

  if p.status = 'paid' then
    return;  -- already processed
  end if;

  update public.payments
  set status = p_status,
      stripe_payment_intent = coalesce(p_payment_intent, stripe_payment_intent)
  where id = p.id;

  if p_status = 'paid' then
    if b.status = 'approved' then
      update public.bookings set status = 'paid' where id = b.id;
    else
      -- Late payment (booking cancelled/expired) or a second payment for the
      -- same booking: keep the money on record and flag for manual refund.
      update public.payments set needs_refund = true where id = p.id;
    end if;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Scheduled jobs (called by pg_cron — see 0005)
-- -----------------------------------------------------------------------------
create or replace function public.expire_unpaid_approvals()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  update public.bookings b
  set status = 'cancelled'
  where b.status = 'approved'
    and b.approved_at + public.payment_window() < now()
    and not exists (
      select 1 from public.payments p
      where p.booking_id = b.id and p.status = 'paid'
    );
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.complete_finished_bookings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  update public.bookings
  set status = 'completed'
  where status = 'paid'
    and end_date < public.market_today();
  get diagnostics n = row_count;
  return n;
end;
$$;

-- -----------------------------------------------------------------------------
-- Read models
-- -----------------------------------------------------------------------------

-- Public reviews with reviewer name, without exposing profiles.
-- Runs with the view owner's rights (intentional).
create or replace view public.public_reviews as
select
  r.id,
  r.booking_id,
  r.listing_id,
  r.rating,
  r.comment,
  r.created_at,
  r.updated_at,
  p.full_name as reviewer_name
from public.reviews r
join public.profiles p on p.id = r.renter_id;

create or replace view public.listing_ratings as
select
  listing_id,
  count(*)::integer             as review_count,
  round(avg(rating)::numeric, 2) as average_rating
from public.reviews
group by listing_id;

create or replace view public.owner_ratings as
select
  l.owner_id,
  count(*)::integer               as review_count,
  round(avg(r.rating)::numeric, 2) as average_rating
from public.reviews r
join public.listings l on l.id = r.listing_id
group by l.owner_id;

-- -----------------------------------------------------------------------------
-- Function permissions
-- -----------------------------------------------------------------------------
-- Private helpers: reachable only from triggers (not exposed via the API).
revoke all on all functions in schema private from public;
grant execute on function
  private.is_verified(uuid),
  private.is_banned(uuid, uuid),
  private.dates_blocked(uuid, date, date),
  private.listing_owner_and_status(uuid),
  private.message_allowed(uuid, uuid),
  private.booking_for_review(uuid),
  private.on_booking_approved(uuid),
  private.on_booking_cancelled(uuid, text)
to anon, authenticated, service_role;

-- System-only public functions
revoke execute on function
  public.record_checkout_session(uuid, text, integer),
  public.apply_stripe_payment(text, uuid, text, integer, text),
  public.expire_unpaid_approvals(),
  public.complete_finished_bookings()
from public, anon, authenticated;
grant execute on function
  public.record_checkout_session(uuid, text, integer),
  public.apply_stripe_payment(text, uuid, text, integer, text),
  public.expire_unpaid_approvals(),
  public.complete_finished_bookings()
to service_role;

-- Owner-callable
revoke execute on function public.owner_cancel_paid_booking(uuid) from public, anon;
grant execute on function public.owner_cancel_paid_booking(uuid) to authenticated, service_role;
