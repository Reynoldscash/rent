import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/page-auth";
import { getCategories, getListingBlocks, getListingDetail } from "@/lib/data/listings";
import { getMyBookings } from "@/lib/data/bookings";
import { marketToday } from "@/lib/dates";
import { Notice } from "@/components/auth-form";
import { ListingForm } from "@/components/listing-form";
import { ImageManager } from "@/components/image-manager";
import { BlockManager } from "@/components/block-manager";
import { DeleteListingButton } from "@/components/delete-listing-button";
import { BookingList } from "@/components/booking-list";
import { Empty, PageTitle, Section } from "@/components/ui";

// frontend-structure.md §8.3 — owner edits one listing.
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> };

export const metadata = { title: "Edit listing · Easy Rent" };

export default async function EditListingPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { created } = await searchParams;
  const { supabase, viewer } = await requirePageUser(`/dashboard/listings/${id}`);

  const listing = await getListingDetail(supabase, id);
  if (!listing || listing.owner_id !== viewer.id) notFound();

  const [categories, blocks, bookings] = await Promise.all([
    getCategories(supabase),
    getListingBlocks(supabase, id),
    getMyBookings(supabase, viewer.id, { role: "owner", listingId: id }),
  ]);

  return (
    <div className="py-8">
      <PageTitle
        title={listing.title}
        back={{ href: "/dashboard/listings", label: "My listings" }}
        action={
          listing.status === "active" && (
            <Link href={`/listings/${listing.id}`} className="text-sm underline">
              View public page
            </Link>
          )
        }
      />
      {created && (
        <div className="mb-4">
          <Notice>Listing created. Add some photos below — the first one becomes the cover.</Notice>
        </div>
      )}

      <Section title="Photos">
        <ImageManager listingId={listing.id} images={listing.images} />
      </Section>

      <Section title="Details">
        <ListingForm
          mode="edit"
          listingId={listing.id}
          categories={categories}
          initial={{
            title: listing.title,
            description: listing.description ?? "",
            category_id: listing.category?.id ?? "",
            price_per_day: String(listing.price_per_day),
            location: listing.location ?? "",
            status: listing.status,
          }}
        />
      </Section>

      <Section title="Blocked dates">
        <BlockManager listingId={listing.id} blocks={blocks} today={marketToday()} />
      </Section>

      <Section title="Bookings for this listing">
        {bookings.length === 0 ? <Empty>No bookings yet.</Empty> : <BookingList rows={bookings} role="owner" />}
      </Section>

      <Section title="Delete">
        {bookings.length > 0 ? (
          <p className="text-sm text-neutral-500">
            Listings with booking history can&apos;t be deleted. Set the status to Inactive instead.
          </p>
        ) : (
          <DeleteListingButton listingId={listing.id} />
        )}
      </Section>
    </div>
  );
}
