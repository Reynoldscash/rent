import { createClient } from "@/lib/supabase/server";

export async function getSignedUrl(bucket: string, path: string, expiresInSeconds = 60) {
  const supabase = await createClient();
  return supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
}
