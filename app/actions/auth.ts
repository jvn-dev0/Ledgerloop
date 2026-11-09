"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/env";

export async function signIn(formData: FormData) {
  if (!hasSupabaseConfig()) redirect("/setup");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
    redirect("/login?error=Enter%20a%20valid%20email%20and%20password%20of%20at%20least%208%20characters.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent("Email or password was not accepted.")}`);
  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  if (!hasSupabaseConfig()) redirect("/setup");
  const businessName = String(formData.get("business_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (businessName.length < 1 || businessName.length > 120) redirect("/signup?error=Enter%20a%20business%20name%20under%20120%20characters.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
    redirect("/signup?error=Enter%20a%20valid%20email%20and%20password%20of%20at%20least%208%20characters.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { business_name: businessName } },
  });
  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  if (data.session) redirect("/dashboard");
  redirect("/login?notice=Check%20your%20email%20to%20confirm%20your%20account,%20then%20sign%20in.");
}

export async function signOut() {
  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Sign out failed", error);
  }
  redirect("/login");
}
