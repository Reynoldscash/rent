import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/session";

/** For protected pages: proxy.ts already redirects, this is a second guard + typed viewer. */
export async function requirePageUser(path: string) {
  const supabase = await createClient();
  const viewer = await getViewer(supabase);
  if (!viewer) redirect(`/signin?next=${encodeURIComponent(path)}`);
  return { supabase, viewer };
}
