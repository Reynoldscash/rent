import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/env";
import { getViewer, type Viewer } from "@/lib/auth/session";
import { signOut } from "@/lib/auth/actions";

async function loadViewer(): Promise<Viewer> {
  if (!hasSupabaseEnv) return null;
  return getViewer(await createClient());
}

const link = "font-medium underline-offset-4 hover:underline";

// frontend-structure.md §1.2
export async function SiteHeader() {
  const viewer = await loadViewer();

  return (
    <header className="border-b border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-5">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Easy Rent
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/listings" className={link}>
              Browse
            </Link>
            {viewer && (
              <Link href="/dashboard" className={link}>
                Dashboard
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-4 text-sm">
          {viewer ? (
            <details className="relative">
              <summary className="cursor-pointer list-none rounded-md border border-neutral-300 px-3 py-1.5 font-medium select-none dark:border-neutral-700">
                Account
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-60 rounded-md border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
                {viewer.email && (
                  <p className="truncate px-2 py-1.5 text-xs text-neutral-500">{viewer.email}</p>
                )}
                <Link href="/dashboard" className="block rounded px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                  Dashboard
                </Link>
                <Link href="/dashboard/profile" className="block rounded px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                  Profile
                </Link>
                <form action={signOut}>
                  <button type="submit" className="block w-full rounded px-2 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800">
                    Sign out
                  </button>
                </form>
              </div>
            </details>
          ) : (
            <>
              <Link href="/signin" className={link}>
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-neutral-900 px-3 py-1.5 font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
