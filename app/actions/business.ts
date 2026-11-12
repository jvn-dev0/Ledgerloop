"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/data/workspace";
import { parseBusinessSettings } from "@/lib/validations/forms";

function settingsUrl(kind: "error" | "notice", message: string) {
  return `/settings?${kind}=${encodeURIComponent(message)}`;
}

export async function updateBusinessSettings(formData: FormData) {
  const parsed = parseBusinessSettings(formData);
  if (!parsed.ok) redirect(settingsUrl("error", parsed.error));

  const { supabase, business, ownerId } = await requireWorkspace();
  const { data, error } = await supabase
    .from("businesses")
    .update(parsed.data)
    .eq("id", business.id)
    .eq("owner_id", ownerId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Business profile update failed", { code: error.code ?? "unknown" });
    redirect(settingsUrl("error", "We could not save your business profile. Try again."));
  }
  if (!data) redirect(settingsUrl("error", "This business profile is unavailable."));

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/invoices/new");
  redirect(settingsUrl("notice", "Business profile updated."));
}
