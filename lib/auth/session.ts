import type { SupabaseClient } from "@supabase/supabase-js";

export type Viewer = { id: string; email: string | null } | null;

/** The signed-in user (from the verified JWT), or null. */
export async function getViewer(supabase: SupabaseClient): Promise<Viewer> {
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}

export async function isViewerVerified(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("is_verified").eq("id", userId).maybeSingle();
  return Boolean(data?.is_verified);
}
