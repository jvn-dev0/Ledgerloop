"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/data/workspace";
import { parseInvoice } from "@/lib/validations/forms";

function errorPath(error: string) {
  return `/invoices/new?error=${encodeURIComponent(error)}`;
}

export async function createInvoice(formData: FormData) {
  const parsed = parseInvoice(formData);
  if (!parsed.ok) redirect(errorPath(parsed.error));
  const { supabase, business } = await requireWorkspace();
  const { error } = await supabase.from("invoices").insert({ ...parsed.data, business_id: business.id });
  if (error) {
    console.error("Invoice creation failed", error);
    if (error.code === "23505") redirect(errorPath("That invoice number is already in use. Choose another number."));
    if (error.code === "23503") redirect(errorPath("Choose a customer belonging to this business."));
    redirect(errorPath("We could not save this invoice. Check your connection and try again."));
  }
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  redirect("/invoices?notice=Invoice%20created.");
}

export async function updateInvoice(invoiceId: string, formData: FormData) {
  const parsed = parseInvoice(formData);
  if (!parsed.ok) redirect(`/invoices/${invoiceId}/edit?error=${encodeURIComponent(parsed.error)}`);
  const { supabase, business } = await requireWorkspace();
  const { data: current, error: currentError } = await supabase
    .from("invoices")
    .select("id, status")
    .eq("id", invoiceId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (currentError) {
    console.error("Invoice lookup before update failed", currentError);
    redirect(`/invoices/${invoiceId}?error=Invoice%20could%20not%20be%20loaded.`);
  }
  if (!current) redirect("/invoices?error=Invoice%20not%20found.");
  if (current.status === "paid") redirect(`/invoices/${invoiceId}?error=Paid%20invoices%20cannot%20be%20edited.`);

  const { data, error } = await supabase
    .from("invoices")
    .update(parsed.data)
    .eq("id", invoiceId)
    .eq("business_id", business.id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Invoice update failed", error);
    if (error.code === "23505") redirect(`/invoices/${invoiceId}/edit?error=That%20invoice%20number%20is%20already%20in%20use.`);
    redirect(`/invoices/${invoiceId}/edit?error=We%20could%20not%20save%20this%20invoice.`);
  }
  if (!data) redirect("/invoices?error=Invoice%20not%20found.");
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/dashboard");
  redirect(`/invoices/${invoiceId}?notice=Invoice%20updated.`);
}
