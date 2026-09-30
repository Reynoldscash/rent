import { SUPABASE_URL } from "@/lib/env";

export const LISTING_IMAGES_BUCKET = "listing-images";
export const AVATARS_BUCKET = "avatars";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Public URL prefix for objects in a bucket. */
export function publicPrefix(bucket: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/`;
}

/** Storage path (inside the bucket) for a public URL, or null if it isn't one of ours. */
export function pathFromPublicUrl(bucket: string, url: string): string | null {
  const prefix = publicPrefix(bucket);
  if (!url.startsWith(prefix)) return null;
  const path = decodeURIComponent(url.slice(prefix.length).split("?")[0]);
  return path.includes("..") ? null : path;
}
