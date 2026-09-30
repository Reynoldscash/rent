import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/routes";

/**
 * Email confirmation link target (frontend-structure.md §2.3).
 * Supabase "Confirm signup" template must link to:
 *   {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email
 * Confirming sets profiles.is_verified = true (database trigger), then the
 * user lands on /dashboard, which shows the success message.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const fail = (message: string) =>
    NextResponse.redirect(new URL(`/signin?error=${encodeURIComponent(message)}`, origin));

  if (!tokenHash || !type) {
    return fail("This confirmation link is invalid.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    return fail("This confirmation link is invalid or has expired. Try signing in, or sign up again.");
  }

  const next = safeNext(searchParams.get("next"), "/dashboard?confirmed=1");
  return NextResponse.redirect(new URL(next, origin));
}
