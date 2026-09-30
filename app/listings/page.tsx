import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCategories, searchListings } from "@/lib/data/listings";
import { ListingCard } from "@/components/listing-card";

// frontend-structure.md §4.2 — same data as GET /api/listings and GET /api/categories
type Props = { searchParams: Promise<{ q?: string; category?: string; location?: string }> };

export const metadata = { title: "Browse listings · Easy Rent" };

const input =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";

export default async function ListingsPage({ searchParams }: Props) {
  const { q = "", category = "", location = "" } = await searchParams;
  const supabase = await createClient();
  const [categories, listings] = await Promise.all([
    getCategories(supabase),
    searchListings(supabase, { q, category, location }),
  ]);
  const filtered = Boolean(q || category || location);

  return (
    <div className="py-8">
      <h1 className="text-2xl font-semibold">Browse listings</h1>

      <form method="get" className="mt-6 grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
        <input name="q" defaultValue={q} placeholder="Search (e.g. drill, tent, camera)" aria-label="Search" className={input} />
        <select name="category" defaultValue={category} aria-label="Category" className={input}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <input name="location" defaultValue={location} placeholder="Location" aria-label="Location" className={input} />
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Search
        </button>
      </form>

      {filtered && (
        <p className="mt-3 text-sm text-neutral-500">
          {listings.length} result{listings.length === 1 ? "" : "s"} ·{" "}
          <Link href="/listings" className="underline">
            Clear filters
          </Link>
        </p>
      )}

      {listings.length === 0 ? (
        <p className="mt-12 text-center text-neutral-500">
          {filtered ? "No listings match your search." : "No listings yet — check back soon."}
        </p>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}
    </div>
  );
}
