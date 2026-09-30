import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getListingDetail } from "@/lib/data/listings";
import { getViewer, isViewerVerified } from "@/lib/auth/session";
import { formatUsd, marketToday } from "@/lib/dates";
import { BookingRequestForm } from "@/components/booking-request-form";
import { Stars } from "@/components/listing-card";

// frontend-structure.md §4.3 — same data as GET /api/listings/:id
type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListingDetail(await createClient(), id);
  return { title: listing ? `${listing.title} · Easy Rent` : "Listing · Easy Rent" };
}

export default async function ListingPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const [listing, viewer] = await Promise.all([getListingDetail(supabase, id), getViewer(supabase)]);
  if (!listing) notFound();

  const isOwner = viewer?.id === listing.owner_id;
  const verified = viewer && !isOwner ? await isViewerVerified(supabase, viewer.id) : false;
  const [cover, ...more] = listing.images;

  return (
    <div className="grid gap-8 py-8 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0">
        <Link href="/listings" className="text-sm text-neutral-500 hover:underline">
          ← All listings
        </Link>

        {listing.status === "inactive" && (
          <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {isOwner
              ? "This listing is inactive and hidden from other people."
              : "This listing isn't taking new requests. Your existing booking is not affected."}
          </p>
        )}

        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{listing.title}</h1>
        <p className="mt-1 text-neutral-600 dark:text-neutral-400">
          {[listing.location, listing.category?.name].filter(Boolean).join(" · ")}
          {listing.rating && (
            <>
              {" · "}
              <Stars value={listing.rating.average_rating} /> ({listing.rating.review_count} review
              {listing.rating.review_count === 1 ? "" : "s"})
            </>
          )}
        </p>

        <div className="mt-5">
          {cover ? (
            <div className="grid gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover.image_url} alt={listing.title} className="aspect-[4/3] w-full rounded-lg object-cover" />
              {more.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {more.map((img) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={img.id} src={img.image_url} alt="" className="aspect-square w-full rounded-md object-cover" loading="lazy" />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-neutral-100 text-neutral-400 dark:bg-neutral-900">
              No photos yet
            </div>
          )}
        </div>

        {listing.owner && (
          <div className="mt-6 flex items-center gap-3">
            {listing.owner.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={listing.owner.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200 text-sm font-medium dark:bg-neutral-800">
                {(listing.owner.full_name ?? "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <p className="text-sm">
              Listed by <span className="font-medium">{listing.owner.full_name ?? "an Easy Rent member"}</span>
            </p>
          </div>
        )}

        {listing.description && (
          <p className="mt-6 whitespace-pre-line leading-relaxed">{listing.description}</p>
        )}

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Reviews</h2>
          {listing.reviews.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">No reviews yet.</p>
          ) : (
            <ul className="mt-4 space-y-5">
              {listing.reviews.map((r) => (
                <li key={r.id} className="border-b border-neutral-200 pb-5 last:border-0 dark:border-neutral-800">
                  <p className="text-sm">
                    <span className="font-medium">{r.reviewer_name ?? "Renter"}</span>
                    <span className="ml-2 text-neutral-500">
                      {"★".repeat(r.rating)}
                      {"☆".repeat(5 - r.rating)}
                    </span>
                  </p>
                  <p className="text-xs text-neutral-500">
                    {new Date(r.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </p>
                  {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-3 text-2xl font-semibold">
          {formatUsd(listing.price_per_day)} <span className="text-base font-normal text-neutral-500">/ day</span>
        </p>

        {isOwner ? (
          <div className="rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
            <p className="font-medium">This is your listing.</p>
            <Link href={`/dashboard/listings/${listing.id}`} className="mt-2 inline-block underline">
              Edit listing and blocked dates
            </Link>
          </div>
        ) : !viewer ? (
          <Link
            href={`/signin?next=${encodeURIComponent(`/listings/${listing.id}`)}`}
            className="block rounded-md bg-neutral-900 px-4 py-2.5 text-center font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Sign in to request a booking
          </Link>
        ) : !verified ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Verify your email to continue. Use the confirmation link we emailed you when you signed up.
          </p>
        ) : listing.status !== "active" ? (
          <p className="text-sm text-neutral-500">This listing isn&apos;t taking new requests.</p>
        ) : (
          <BookingRequestForm
            listingId={listing.id}
            pricePerDay={listing.price_per_day}
            blocked={listing.blocked}
            today={marketToday()}
          />
        )}
      </aside>
    </div>
  );
}
