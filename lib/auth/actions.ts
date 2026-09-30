"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/env";
import { safeNext } from "@/lib/auth/routes";

function field(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim() : "";
}

function back(path: string, error: string, extra: Record<string, string> = {}): never {
  const params = new URLSearchParams({ error, ...extra });
  redirect(`${path}?${params.toString()}`);
}

export async function signIn(formData: FormData) {
  const email = field(formData, "email");
  const password = formData.get("password");
  const next = safeNext(field(formData, "next"), "/dashboard");

  if (!email || typeof password !== "string" || !password) {
    back("/signin", "Enter your email and password.", { next });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const message =
      error.code === "email_not_confirmed"
        ? "Please confirm your email first — check your inbox for the link."
        : "Incorrect email or password.";
    back("/signin", message, { next });
  }

  redirect(next);
}

export async function signUp(formData: FormData) {
  const fullName = field(formData, "full_name");
  const email = field(formData, "email");
  const password = formData.get("password");

  if (!fullName || !email || typeof password !== "string") {
    back("/signup", "Please fill in every field.");
  }
  if (password.length < 8) {
    back("/signup", "Password must be at least 8 characters.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Read by the handle_new_user trigger to fill profiles.full_name.
      data: { full_name: fullName },
      emailRedirectTo: `${SITE_URL}/auth/callback`,
    },
  });

  if (error) {
    back("/signup", error.message);
  }

  redirect("/signup?sent=1");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
