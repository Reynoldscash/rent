-- =============================================================================
-- Easy Rent — 0006: error messages match brain/api-spec.md wording
-- Re-creates three functions from 0002; logic is unchanged, only message text.
-- =============================================================================

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
    raise exception 'Dates unavailable' using errcode = 'P0001';
  end;

  update public.bookings
  set status = 'rejected'
  where listing_id = b.listing_id
    and id <> b.id
    and status = 'pending'
    and daterange(start_date, end_date, '[)') && daterange(b.start_date, b.end_date, '[)');
end;
$$;

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
    raise exception 'Listing inactive' using errcode = 'P0001';
  end if;

  if v_owner_id = new.renter_id then
    raise exception 'Cannot book your own listing' using errcode = 'P0001';
  end if;

  if private.is_banned(v_owner_id, new.renter_id) then
    -- Neutral on purpose: the renter must never learn they are banned.
    raise exception 'This booking cannot be created' using errcode = 'P0001';
  end if;

  if not private.is_verified(new.renter_id) then
    raise exception 'You must verify your email to request a booking' using errcode = 'P0001';
  end if;

  if new.start_date is null or new.end_date is null or new.start_date >= new.end_date then
    raise exception 'The end date must be after the start date.' using errcode = 'P0001';
  end if;

  if new.start_date < public.market_today() then
    raise exception 'The start date cannot be in the past.' using errcode = 'P0001';
  end if;

  if private.dates_blocked(new.listing_id, new.start_date, new.end_date) then
    raise exception 'Dates unavailable' using errcode = 'P0001';
  end if;

  -- System-controlled fields
  new.owner_id    := v_owner_id;
  new.total_price := public.calculate_total_price(new.listing_id, new.start_date, new.end_date);
  new.status      := 'pending';
  new.approved_at := null;

  return new;
end;
$$;

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
    raise exception 'This booking cannot be updated at this time' using errcode = 'P0001';
  end if;

  return new;
end;
$$;
