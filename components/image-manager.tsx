"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { callApi } from "@/lib/client-api";
import { IMAGE_TYPES, LISTING_IMAGES_BUCKET, MAX_IMAGE_BYTES } from "@/lib/storage";
import { btn } from "@/components/ui";

type Image = { id: string; image_url: string };

// Steps 2–3 of the image flow (api-spec.md §2): upload to
// listing-images/<listing_id>/<file>, then POST /api/listings/:id/images.
export function ImageManager({ listingId, images }: { listingId: string; images: Image[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setBusy(true);
    const supabase = createClient();
    for (const file of Array.from(files)) {
      if (!IMAGE_TYPES.includes(file.type)) {
        setError(`${file.name}: only JPEG, PNG or WebP images`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setError(`${file.name}: images must be under 5 MB`);
        continue;
      }
      const ext = file.type.split("/")[1].replace("jpeg", "jpg");
      const path = `${listingId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(LISTING_IMAGES_BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) {
        setError(`${file.name}: upload failed (${upErr.message})`);
        continue;
      }
      const { data } = supabase.storage.from(LISTING_IMAGES_BUCKET).getPublicUrl(path);
      const res = await callApi(`/api/listings/${listingId}/images`, "POST", { image_url: data.publicUrl });
      if (res.error) {
        setError(res.error);
        await supabase.storage.from(LISTING_IMAGES_BUCKET).remove([path]);
      }
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  async function remove(imageId: string) {
    if (!window.confirm("Remove this photo?")) return;
    setBusy(true);
    const res = await callApi(`/api/listings/${listingId}/images/${imageId}`, "DELETE");
    setBusy(false);
    if (res.error) setError(res.error);
    router.refresh();
  }

  return (
    <div>
      {images.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((img, i) => (
            <div key={img.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.image_url} alt="" className="aspect-square w-full rounded-md object-cover" />
              {i === 0 && <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white">Cover</span>}
              <button
                type="button"
                onClick={() => remove(img.id)}
                disabled={busy}
                className="absolute right-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white hover:bg-black/80"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-neutral-500">No photos yet. Listings with photos get far more requests.</p>
      )}
      <div className="mt-3 flex items-center gap-3">
        <input
          ref={input}
          type="file"
          accept={IMAGE_TYPES.join(",")}
          multiple
          className="hidden"
          onChange={(e) => upload(e.target.files)}
        />
        <button type="button" className={btn.secondary} disabled={busy} onClick={() => input.current?.click()}>
          {busy ? "Uploading…" : "Add photos"}
        </button>
        <span className="text-xs text-neutral-500">JPEG, PNG or WebP, up to 5 MB each. The first photo is the cover.</span>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
