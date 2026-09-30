import { requirePageUser } from "@/lib/page-auth";
import { isViewerVerified } from "@/lib/auth/session";
import { getCategories } from "@/lib/data/listings";
import { ListingForm } from "@/components/listing-form";
import { PageTitle } from "@/components/ui";

// frontend-structure.md §4.4 — POST /api/listings, then photos on the editor page.
export const metadata = { title: "New listing · Easy Rent" };

export default async function NewListingPage() {
  const { supabase, viewer } = await requirePageUser("/listings/new");
  const [verified, categories] = await Promise.all([isViewerVerified(supabase, viewer.id), getCategories(supabase)]);

  return (
    <div className="py-8">
      <PageTitle title="List an item" back={{ href: "/dashboard", label: "Dashboard" }} />
      {verified ? (
        <>
          <p className="mb-6 max-w-xl text-sm text-neutral-600 dark:text-neutral-400">
            You&apos;ll add photos and blocked dates on the next screen.
          </p>
          <ListingForm mode="create" categories={categories} />
        </>
      ) : (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Verify your email to continue.
        </p>
      )}
    </div>
  );
}
