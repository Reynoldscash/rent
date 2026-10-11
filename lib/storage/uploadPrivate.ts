import { createClient } from "@/lib/supabase/server";

export async function uploadPrivate(bucket: string, path: string, file: File) {
  const supabase = await createClient();
  return supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
}
