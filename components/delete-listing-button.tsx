"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { callApi } from "@/lib/client-api";
import { btn } from "@/components/ui";

export function DeleteListingButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm("Delete this listing permanently? This can't be undone.")) return;
    setBusy(true);
    const res = await callApi(`/api/listings/${listingId}`, "DELETE");
    setBusy(false);
    if (res.error) return setError(res.error);
    router.push("/dashboard/listings");
    router.refresh();
  }

  return (
    <div>
      <button type="button" className={btn.danger} disabled={busy} onClick={remove}>
        {busy ? "Deleting…" : "Delete listing"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
