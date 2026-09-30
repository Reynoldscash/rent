import subprocess, uuid, sys
fails=0
def run(sql, as_uid=None, role=None):
    pre = ""
    if role: pre += f"set role {role};"
    if as_uid: pre += f"set request.jwt.claim.sub = '{as_uid}';"
    r = subprocess.run(["psql","-h","/tmp","-p","54329","-U","postgres","-d","t","-tAq","-v","ON_ERROR_STOP=1","-c",pre+sql],capture_output=True,text=True)
    return r.returncode==0, (r.stdout.strip() if r.returncode==0 else r.stderr.strip())
def ok(name, sql, **kw):
    global fails
    s,o = run(sql, **kw)
    print(("PASS " if s else "FAIL ")+name+("" if s else "  -> "+o)); fails += (not s); return o
def err(name, sql, expect, **kw):
    global fails
    s,o = run(sql, **kw)
    good = (not s) and expect.lower() in o.lower()
    print(("PASS " if good else "FAIL ")+name+("" if good else f"  -> success={s} out={o}")); fails += (not good)
def eq(name, sql, want, **kw):
    global fails
    s,o = run(sql, **kw)
    good = s and o==str(want)
    print(("PASS " if good else "FAIL ")+name+("" if good else f"  -> got {o!r}, want {want!r}")); fails += (not good)

A = lambda u: dict(as_uid=u, role="authenticated")
SYS = {}
owner, renter, renter2, unver, stranger = [str(uuid.uuid4()) for _ in range(5)]
for u,c in [(owner,True),(renter,True),(renter2,True),(unver,False),(stranger,True)]:
    ok(f"signup {u[:4]}", f"insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values ('{u}','{u[:4]}@x.com',{'now()' if c else 'null'},'{{\"full_name\":\"User {u[:4]}\"}}')")
eq("profile auto-created + verified", f"select is_verified from profiles where id='{owner}'", "t")
eq("unverified profile", f"select is_verified from profiles where id='{unver}'", "f")
err("client cannot set is_verified", f"update profiles set is_verified=true where id='{unver}'", "permission denied", **A(unver))
ok("client updates own name", f"update profiles set full_name='New' where id='{renter}'", **A(renter))
ok("confirm email later", f"update auth.users set email_confirmed_at=now() where id='{unver}'")
eq("is_verified synced", f"select is_verified from profiles where id='{unver}'", "t")
ok("un-verify for tests", f"update profiles set is_verified=false where id='{unver}'")

# listings
L = ok("owner creates listing", "insert into listings(title,price_per_day,location) values ('Drill',25,'Austin') returning id", **A(owner)).splitlines()[0]
err("unverified cannot create listing", "insert into listings(title,price_per_day) values ('X',10)", "row-level security", **A(unver))
err("cannot spoof owner_id", f"insert into listings(owner_id,title,price_per_day) values ('{renter}','X',10)", "permission denied", **A(owner))
err("price must be > 0", "insert into listings(title,price_per_day) values ('X',0)", "check constraint", **A(owner))
eq("anon sees active listing", f"select count(*) from listings where id='{L}'", 1, role="anon")
eq("anon sees owner profile", f"select count(*) from profiles where id='{owner}'", 1, role="anon")
eq("anon cannot see renter profile", f"select count(*) from profiles where id='{renter}'", 0, role="anon")
eq("non-owner update affects 0 rows", f"with u as (update listings set title='hack' where id='{L}' returning 1) select count(*) from u", 0, **A(renter))

d = lambda n: f"(market_today()+{n})"
# bookings
err("unverified cannot book", f"insert into bookings(listing_id,start_date,end_date) values ('{L}',current_date+5,current_date+7)", "verify your email", **A(unver))
err("owner cannot book own", f"insert into bookings(listing_id,start_date,end_date) values ('{L}',current_date+5,current_date+7)", "own listing", **A(owner))
err("past start date", f"insert into bookings(listing_id,start_date,end_date) values ('{L}',current_date-3,current_date+2)", "past", **A(renter))
err("end before start", f"insert into bookings(listing_id,start_date,end_date) values ('{L}',current_date+5,current_date+5)", "after the start", **A(renter))
err("client cannot set total_price", f"insert into bookings(listing_id,start_date,end_date,total_price) values ('{L}',current_date+5,current_date+7,1)", "permission denied", **A(renter))
B1 = ok("renter requests booking", f"insert into bookings(listing_id,start_date,end_date) values ('{L}',current_date+10,current_date+13) returning id", **A(renter)).splitlines()[0]
eq("server computed price (3 days x 25)", f"select total_price||'/'||status||'/'||owner_id from bookings where id='{B1}'", f"75.00/pending/{owner}")
B2 = ok("second renter overlapping pending allowed", f"insert into bookings(listing_id,start_date,end_date) values ('{L}',current_date+12,current_date+15) returning id", **A(renter2)).splitlines()[0]
B3 = ok("non-overlapping pending", f"insert into bookings(listing_id,start_date,end_date) values ('{L}',current_date+20,current_date+22) returning id", **A(renter2)).splitlines()[0]
eq("stranger sees no bookings", "select count(*) from bookings", 0, **A(stranger))
err("renter cannot approve", f"update bookings set status='approved' where id='{B1}'", "not allowed", **A(renter))
err("client cannot change dates", f"update bookings set end_date=end_date+1 where id='{B1}'", "permission denied", **A(owner))
ok("owner approves", f"update bookings set status='approved' where id='{B1}'", **A(owner))
eq("approved_at set + block created", f"select (approved_at is not null)::text||'/'||(select count(*) from availability_blocks where booking_id='{B1}') from bookings where id='{B1}'", "true/1")
eq("overlapping pending auto-rejected", f"select status from bookings where id='{B2}'", "rejected")
eq("non-overlapping pending untouched", f"select status from bookings where id='{B3}'", "pending")
err("new request on blocked dates", f"insert into bookings(listing_id,start_date,end_date) values ('{L}',current_date+11,current_date+12)", "not available", **A(stranger))
# manual blocks
ok("owner adds manual block", f"insert into availability_blocks(listing_id,start_date,end_date) values ('{L}',current_date+21,current_date+25)", **A(owner))
err("renter cannot add block", f"insert into availability_blocks(listing_id,start_date,end_date) values ('{L}',current_date+40,current_date+41)", "row-level security", **A(renter))
err("client cannot add booking block", f"insert into availability_blocks(listing_id,start_date,end_date,source) values ('{L}',current_date+40,current_date+41,'booking')", "permission denied", **A(owner))
err("manual block overlapping booking block rejected", f"insert into availability_blocks(listing_id,start_date,end_date) values ('{L}',current_date+12,current_date+14)", "availability_blocks_no_overlap", **A(owner))
err("approval over manual block fails", f"update bookings set status='approved' where id='{B3}'", "no longer available", **A(owner))
eq("failed approval rolled back", f"select status||'/'||coalesce(approved_at::text,'null') from bookings where id='{B3}'", "pending/null")
eq("owner cannot delete booking block", f"with d as (delete from availability_blocks where booking_id='{B1}' returning 1) select count(*) from d", 0, **A(owner))

# messaging
ok("renter messages", f"insert into messages(booking_id,content) values ('{B1}','hi')", **A(renter))
ok("owner replies", f"insert into messages(booking_id,content) values ('{B1}','hello')", **A(owner))
err("stranger cannot message", f"insert into messages(booking_id,content) values ('{B1}','x')", "cannot be updated", **A(stranger))
err("rejected booking thread closed", f"insert into messages(booking_id,content) values ('{B2}','x')", "cannot be updated", **A(renter2))
eq("stranger cannot read messages", "select count(*) from messages", 0, **A(stranger))

# payments
err("client cannot call webhook fn", f"select apply_stripe_payment('cs_1','{B1}','pi_1',7500,'paid')", "permission denied", **A(renter))
err("amount mismatch rejected", f"select record_checkout_session('{B1}','cs_1',100)", "does not match", role="service_role")
ok("record checkout session", f"select record_checkout_session('{B1}','cs_1',7500)", role="service_role")
ok("webhook paid", f"select apply_stripe_payment('cs_1','{B1}','pi_1',7500,'paid')", role="service_role")
ok("webhook repeated (idempotent)", f"select apply_stripe_payment('cs_1','{B1}','pi_1',7500,'paid')", role="service_role")
eq("booking paid, one payment row", f"select b.status||'/'||(select count(*) from payments where booking_id=b.id) from bookings b where id='{B1}'", "paid/1")
eq("renter sees payment", f"select count(*) from payments where booking_id='{B1}'", 1, **A(renter))
err("renter cannot cancel paid", f"update bookings set status='cancelled' where id='{B1}'", "not allowed", **A(renter))
err("owner cannot cancel paid directly", f"update bookings set status='cancelled' where id='{B1}'", "not allowed", **A(owner))
err("client cannot mark completed", f"update bookings set status='completed' where id='{B1}'", "not allowed", **A(owner))

# completion + reviews (move booking dates into the past as system)
ok("system: backdate B1 for completion test", f"alter table bookings disable trigger bookings_before_update; update bookings set start_date=current_date-5, end_date=current_date-2 where id='{B1}'; alter table bookings enable trigger bookings_before_update")
err("review before completion", f"insert into reviews(booking_id,rating,comment) values ('{B1}',5,'great')", "completed booking", **A(renter))
eq("completion job", "select complete_finished_bookings()", 1)
eq("B1 completed", f"select status from bookings where id='{B1}'", "completed")
err("stranger cannot review", f"insert into reviews(booking_id,rating) values ('{B1}',1)", "completed booking", **A(stranger))
err("rating range", f"insert into reviews(booking_id,rating) values ('{B1}',6)", "check constraint", **A(renter))
ok("renter reviews", f"insert into reviews(booking_id,rating,comment) values ('{B1}',5,'great')", **A(renter))
err("second review blocked", f"insert into reviews(booking_id,rating) values ('{B1}',4)", "duplicate key", **A(renter))
eq("public_reviews shows name, anon", f"select reviewer_name||'/'||rating from public_reviews where booking_id='{B1}'", "New/5", role="anon")
eq("listing rating", f"select review_count||'/'||average_rating from listing_ratings where listing_id='{L}'", "1/5.00", role="anon")
err("anon cannot read reviews table directly", "select count(*) from reviews", "permission denied", role="anon")
# bans
err("owner cannot ban stranger (no booking)", f"insert into owner_bans(banned_user_id) values ('{stranger}')", "row-level security", **A(owner))
ok("owner bans renter2", f"insert into owner_bans(banned_user_id,reason) values ('{renter2}','no-show')", **A(owner))
eq("renter2 cannot see ban", "select count(*) from owner_bans", 0, **A(renter2))
err("banned renter booking -> neutral error", f"insert into bookings(listing_id,start_date,end_date) values ('{L}',current_date+30,current_date+31)", "This booking cannot be created.", **A(renter2))
err("banned renter messaging -> neutral", f"insert into messages(booking_id,content) values ('{B3}','x')", "cannot be updated at this time", **A(renter2))
ok("owner can still reject banned renter's pending", f"update bookings set status='rejected' where id='{B3}'", **A(owner))

# paid cancellation by owner, expiry, late payment
B4 = ok("renter books again", f"insert into bookings(listing_id,start_date,end_date) values ('{L}',current_date+40,current_date+42) returning id", **A(renter)).splitlines()[0]
ok("approve B4", f"update bookings set status='approved' where id='{B4}'", **A(owner))
ok("pay B4", f"select apply_stripe_payment('cs_4','{B4}','pi_4',5000,'paid')", role="service_role")
err("renter cannot use owner cancel fn", f"select owner_cancel_paid_booking('{B4}')", "not found", **A(renter))
ok("owner cancels paid via function", f"select owner_cancel_paid_booking('{B4}')", **A(owner))
eq("B4 cancelled, block gone, refund flagged", f"select b.status||'/'||(select count(*) from availability_blocks where booking_id=b.id)||'/'||(select needs_refund from payments where booking_id=b.id) from bookings b where id='{B4}'", "cancelled/0/true")

B5 = ok("renter books B5", f"insert into bookings(listing_id,start_date,end_date) values ('{L}',current_date+50,current_date+52) returning id", **A(renter)).splitlines()[0]
ok("approve B5", f"update bookings set status='approved' where id='{B5}'", **A(owner))
ok("age approval 25h", f"update bookings set approved_at=now()-interval '25 hours' where id='{B5}'")
eq("expiry job cancels", "select expire_unpaid_approvals()", 1)
eq("B5 cancelled + block removed", f"select status||'/'||(select count(*) from availability_blocks where booking_id='{B5}') from bookings where id='{B5}'", "cancelled/0")
ok("late payment arrives", f"select apply_stripe_payment('cs_5','{B5}','pi_5',5000,'paid')", role="service_role")
eq("late payment recorded, flagged, booking stays cancelled", f"select b.status||'/'||p.status||'/'||p.needs_refund from bookings b join payments p on p.booking_id=b.id where b.id='{B5}'", "cancelled/paid/true")

B6 = ok("renter books B6", f"insert into bookings(listing_id,start_date,end_date) values ('{L}',current_date+60,current_date+61) returning id", **A(renter)).splitlines()[0]
ok("renter cancels pending", f"update bookings set status='cancelled' where id='{B6}'", **A(renter))
err("cancelled cannot be revived", f"update bookings set status='approved' where id='{B6}'", "cannot move", **A(owner))

# listing delete rules
err_note = ok("owner creates empty listing", "insert into listings(title,price_per_day) values ('Tent',10) returning id", **A(owner)).splitlines()[0]
eq("delete listing with bookings blocked", f"with d as (delete from listings where id='{L}' returning 1) select count(*) from d", 0, **A(owner))
eq("delete listing without bookings ok", f"with d as (delete from listings where id='{err_note}' returning 1) select count(*) from d", 1, **A(owner))
ok("owner deactivates listing", f"update listings set status='inactive' where id='{L}'", **A(owner))
err("inactive listing cannot be booked", f"insert into bookings(listing_id,start_date,end_date) values ('{L}',current_date+70,current_date+72)", "not available", **A(renter))
eq("anon no longer sees inactive", f"select count(*) from listings where id='{L}'", 0, role="anon")

# storage
ok("owner uploads listing image", f"insert into storage.objects(bucket_id,name) values ('listing-images','{L}/a.jpg')", **A(owner))
err("renter cannot upload to owner's listing", f"insert into storage.objects(bucket_id,name) values ('listing-images','{L}/b.jpg')", "row-level security", **A(renter))
ok("user uploads own avatar", f"insert into storage.objects(bucket_id,name) values ('avatars','{renter}/me.png')", **A(renter))
err("user cannot upload others' avatar", f"insert into storage.objects(bucket_id,name) values ('avatars','{owner}/me.png')", "row-level security", **A(renter))
print("\nFAILURES:", fails)
