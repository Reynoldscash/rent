import Link from "next/link";
import { hasSupabaseEnv } from "@/lib/env";

// frontend-structure.md §4.1 — static landing page
const steps = [
  { title: "Find it", body: "Browse items people near you are renting out — tools, gear, equipment and more." },
  { title: "Request dates", body: "Pick your pick-up and return days. The owner approves or declines your request." },
  { title: "Pay and pick up", body: "Once approved, pay securely within 24 hours to lock in your dates." },
];

export default function HomePage() {
  return (
    <div className="py-12 sm:py-20">
      {!hasSupabaseEnv && (
        <p className="mb-8 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Supabase environment variables are missing. See README.md.
        </p>
      )}

      <section className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Rent anything from people nearby.</h1>
        <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
          Why buy something you&apos;ll use twice? Borrow it from a neighbour — or earn from the things you
          already own.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/listings"
            className="rounded-md bg-neutral-900 px-5 py-2.5 font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Browse listings
          </Link>
          <Link
            href="/signup"
            className="rounded-md border border-neutral-300 px-5 py-2.5 font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Sign up to list your stuff
          </Link>
        </div>
      </section>

      <section className="mt-16 grid gap-6 sm:grid-cols-3">
        {steps.map((s, i) => (
          <div key={s.title} className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
            <p className="text-sm font-medium text-neutral-500">Step {i + 1}</p>
            <h2 className="mt-1 text-lg font-semibold">{s.title}</h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{s.body}</p>
          </div>
        ))}
      </section>

      <p className="mt-10 text-sm text-neutral-600 dark:text-neutral-400">
        Already have an account?{" "}
        <Link href="/signin" className="font-medium underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
