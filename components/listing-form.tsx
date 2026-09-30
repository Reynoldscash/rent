"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { callApi } from "@/lib/client-api";
import type { Category } from "@/lib/data/listings";
import { btn, inputClass } from "@/components/ui";

type Values = {
  title: string;
  description: string;
  category_id: string;
  price_per_day: string;
  location: string;
  status: "active" | "inactive";
};

type Props =
  | { mode: "create"; categories: Category[]; initial?: undefined; listingId?: undefined }
  | { mode: "edit"; categories: Category[]; initial: Values; listingId: string };

// Create: POST /api/listings then go to the editor to add photos (three-step image flow).
// Edit: PATCH /api/listings/:id.
export function ListingForm({ mode, categories, initial, listingId }: Props) {
  const router = useRouter();
  const [v, setV] = useState<Values>(
    initial ?? { title: "", description: "", category_id: "", price_per_day: "", location: "", status: "active" },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setSaved(false);
    setV({ ...v, [k]: e.target.value });
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = {
      title: v.title,
      description: v.description,
      category_id: v.category_id || null,
      price_per_day: Number(v.price_per_day),
      location: v.location,
      ...(mode === "edit" ? { status: v.status } : {}),
    };
    if (mode === "create") {
      const res = await callApi<{ id: string }>("/api/listings", "POST", payload);
      setBusy(false);
      if (res.error) return setError(res.error);
      router.push(`/dashboard/listings/${res.data.id}?created=1`);
    } else {
      const res = await callApi(`/api/listings/${listingId}`, "PATCH", payload);
      setBusy(false);
      if (res.error) return setError(res.error);
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="grid max-w-xl gap-4">
      <label className="text-sm">
        <span className="mb-1 block font-medium">Title</span>
        <input required minLength={3} maxLength={120} value={v.title} onChange={set("title")} className={inputClass} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Description</span>
        <textarea rows={5} maxLength={5000} value={v.description} onChange={set("description")} className={inputClass} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Category</span>
          <select value={v.category_id} onChange={set("category_id")} className={inputClass}>
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Price per day (USD)</span>
          <input required type="number" min="0.01" step="0.01" value={v.price_per_day} onChange={set("price_per_day")} className={inputClass} />
        </label>
      </div>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Location</span>
        <input maxLength={120} placeholder="e.g. Austin, TX" value={v.location} onChange={set("location")} className={inputClass} />
      </label>
      {mode === "edit" && (
        <label className="text-sm">
          <span className="mb-1 block font-medium">Status</span>
          <select value={v.status} onChange={set("status")} className={inputClass}>
            <option value="active">Active — visible and bookable</option>
            <option value="inactive">Inactive — hidden, no new requests (existing bookings continue)</option>
          </select>
        </label>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className={btn.primary}>
          {busy ? "Saving…" : mode === "create" ? "Create listing" : "Save changes"}
        </button>
        {saved && <span className="text-sm text-emerald-700 dark:text-emerald-300">Saved</span>}
      </div>
    </form>
  );
}
