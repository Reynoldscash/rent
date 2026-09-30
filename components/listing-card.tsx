import Link from "next/link";
import type { ListingSummary } from "@/lib/data/listings";
import { formatUsd } from "@/lib/dates";

export function Stars({ value }: { value: number }) {
  return <span aria-label={`${value.toFixed(1)} out of 5`}>★ {value.toFixed(1)}</span>;
}

export function ListingCard({ listing }: { listing: ListingSummary }) {
  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group block overflow-hidden rounded-lg border border-neutral-200 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
    >
      <div className="aspect-[4/3] bg-neutral-100 dark:bg-neutral-900">
        {listing.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-neutral-400">No photo</div>
        )}
      </div>
      <div className="p-3">
        <h3 className="truncate font-medium group-hover:underline">{listing.title}</h3>
        <p className="mt-0.5 truncate text-sm text-neutral-500">
          {[listing.location, listing.category?.name].filter(Boolean).join(" · ") || " "}
        </p>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span>
            <span className="font-semibold">{formatUsd(listing.price_per_day)}</span>
            <span className="text-neutral-500"> / day</span>
          </span>
          {listing.rating && (
            <span className="text-neutral-600 dark:text-neutral-400">
              <Stars value={listing.rating.average_rating} /> ({listing.rating.review_count})
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
