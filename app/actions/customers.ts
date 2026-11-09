"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/data/workspace";
import { parseCustomer } from "@/lib/validations/forms";

function customerError(message: string) {
  return `/customers/new?error=${encodeURIComponent(message)}`;
}

export async function createCustomer(formData: FormData) {
  const parsed = parseCustomer(formData);
  if (!parsed.ok) redirect(customerError(parsed.error));
  const { supabase, business } = await requireWorkspace();
  const { error } = await supabase.from("customers").insert({ ...parsed.data, business_id: business.id });
  if (error) {
    console.error("Customer creation failed", error);
    redirect(customerError(error.code === "23505" ? "A customer with these details already exists." : "We could not save this customer. Check your connection and try again."));
  }
  revalidatePath("/customers");
  revalidatePath("/dashboard");
  redirect("/customers?notice=Customer%20created.");
}

export async function updateCustomer(customerId: string, formData: FormData) {
  const parsed = parseCustomer(formData);
  if (!parsed.ok) redirect(`/customers/${customerId}/edit?error=${encodeURIComponent(parsed.error)}`);
  const { supabase, business } = await requireWorkspace();
  const { data, error } = await supabase
    .from("customers")
    .update(parsed.data)
    .eq("id", customerId)
    .eq("business_id", business.id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Customer update failed", error);
    redirect(`/customers/${customerId}/edit?error=${encodeURIComponent("We could not save this customer. Try again.")}`);
  }
  if (!data) redirect("/customers?error=Customer%20not%20found.");
  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/dashboard");
  redirect(`/customers/${customerId}?notice=Customer%20updated.`);
}
