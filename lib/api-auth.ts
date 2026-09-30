import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getViewer, type Viewer } from "@/lib/auth/session";
import { jsonError } from "@/lib/api";

/**
 * Supabase client acting as the signed-in user + that user.
 * Returns an error response instead when nobody is signed in.
 */
export async function requireUser(): Promise<
  { supabase: SupabaseClient; viewer: NonNullable<Viewer>; response?: undefined } | { response: Response; supabase?: undefined; viewer?: undefined }
> {
  const supabase = await createClient();
  const viewer = await getViewer(supabase);
  if (!viewer) return { response: jsonError("Sign in required", 401) };
  return { supabase, viewer };
}
