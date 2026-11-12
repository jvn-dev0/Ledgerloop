"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { getAppOrigin } from "@/lib/supabase/app-url";

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
    options: {
      data: { business_name: businessName },
      emailRedirectTo: new URL("/auth/callback?next=/dashboard", getAppOrigin()).toString(),
    },
  });
  if (error) {
    console.error("Account creation failed", { code: error.code ?? "unknown" });
    const message = error.code === "over_email_send_rate_limit"
      ? "Confirmation emails are temporarily limited. Check your inbox or spam folder, then try again later."
      : error.code === "email_address_invalid"
        ? "Use a valid email address and try again."
        : "We could not create the account. Check the details and try again.";
    redirect(`/signup?error=${encodeURIComponent(message)}`);
  }
  if (data.session) redirect("/dashboard");
  redirect("/login?notice=Check%20your%20email%20to%20confirm%20your%20account,%20then%20sign%20in.");
}

export async function requestPasswordReset(formData: FormData) {
  if (!hasSupabaseConfig()) redirect("/setup");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/forgot-password?error=Enter%20a%20valid%20email%20address.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: new URL("/auth/callback?next=/reset-password", getAppOrigin()).toString(),
  });
  if (error) console.error("Password reset request failed", { code: error.code ?? "unknown" });
  redirect("/forgot-password?notice=If%20an%20account%20uses%20that%20address%2C%20reset%20instructions%20will%20arrive%20by%20email.");
}

export async function updatePassword(formData: FormData) {
  if (!hasSupabaseConfig()) redirect("/setup");
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirm_password") ?? "");
  if (password.length < 8 || password.length > 128) {
    redirect("/reset-password?error=Use%20a%20password%20between%208%20and%20128%20characters.");
  }
  if (password !== confirmation) redirect("/reset-password?error=The%20passwords%20do%20not%20match.");

  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims?.sub) {
    redirect("/reset-password?error=Open%20the%20latest%20password%20reset%20email%20to%20continue.");
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("Password update failed", { code: error.code ?? "unknown" });
    redirect("/reset-password?error=The%20password%20could%20not%20be%20updated.%20Request%20a%20new%20reset%20email.");
  }
  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) console.error("Sign out after password reset failed", { code: signOutError.code ?? "unknown" });
  redirect("/login?notice=Your%20password%20has%20been%20updated.%20Sign%20in%20with%20the%20new%20password.");
}

export async function signOut() {
  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Sign out failed", { code: error.code ?? "unknown" });
  }
  redirect("/login");
}
