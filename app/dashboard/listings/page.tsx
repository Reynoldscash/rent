import Link from "next/link";
import { requirePageUser } from "@/lib/page-auth";
import { getMyListings } from "@/lib/data/listings";
import { formatUsd } from "@/lib/dates";
import { Empty, ListingStatusBadge, PageTitle, btn } from "@/components/ui";

// frontend-structure.md §8.1 — data: GET /api/me/listings
export const metadata = { title: "My listings · Easy Rent" };

export default async function MyListingsPage() {
  const { supabase, viewer } = await requirePageUser("/dashboard/listings");
  const listings = await getMyListings(supabase, viewer.id);

  return (
    <div className="py-8">
      <PageTitle
        title="My listings"
        back={{ href: "/dashboard", label: "Dashboard" }}
        action={
          <Link href="/listings/new" className={btn.primary}>
            New listing
          </Link>
        }
      />
      {listings.length === 0 ? (
        <Empty>You haven&apos;t listed anything yet.</Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {listings.map((l) => (
            <li key={l.id} className="flex gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
              <div className="h-20 w-24 shrink-0 overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-900">
                {l.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.image_url} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{l.title}</p>
                <p className="text-sm text-neutral-500">
                  {formatUsd(l.price_per_day)}/day{l.location ? ` · ${l.location}` : ""}
                </p>
                <div className="mt-2 flex items-center gap-3 text-sm">
                  <ListingStatusBadge status={l.status} />
                  <Link href={`/dashboard/listings/${l.id}`} className="underline">
                    Edit
                  </Link>
                  {l.status === "active" && (
                    <Link href={`/listings/${l.id}`} className="underline">
                      View
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
