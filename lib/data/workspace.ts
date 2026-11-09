import { redirect } from "next/navigation";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function requireWorkspace() {
  if (!hasSupabaseConfig()) redirect("/setup");

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  const ownerId = claims?.claims?.sub;

  if (authError || !ownerId) redirect("/login");

  const { data: business, error } = await supabase
    .from("businesses")
    .select("id, name, owner_id, default_currency, created_at, updated_at")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load the signed-in business", error);
    redirect("/setup?reason=business");
  }
  if (!business) redirect("/setup?reason=business");

  return { supabase, business, ownerId, email: claims.claims.email ?? "" };
}
