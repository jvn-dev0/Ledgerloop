import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { hashPaymentLinkToken } from "./server";

export type CheckoutInvoice = {
  id: string;
  business_id: string;
  invoice_number: string;
  description: string;
  amount: string;
  currency: string;
  due_date: string;
  status: "draft" | "pending" | "paid" | "cancelled";
  customer: { name: string; email: string } | null;
  business: { name: string } | null;
};

export function validPaymentToken(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export async function findCheckoutInvoice(token: string): Promise<CheckoutInvoice | null> {
  if (!validPaymentToken(token)) return null;
  const admin = createAdminClient();
  const { data: link, error: linkError } = await admin
    .from("invoice_payment_links")
    .select("invoice_id, business_id")
    .eq("token_hash", hashPaymentLinkToken(token))
    .is("revoked_at", null)
    .maybeSingle();
  if (linkError || !link) return null;

  const { data: invoice, error: invoiceError } = await admin
    .from("invoices")
    .select("id, business_id, customer_id, invoice_number, description, amount, currency, due_date, status")
    .eq("id", link.invoice_id)
    .eq("business_id", link.business_id)
    .maybeSingle();
  if (invoiceError || !invoice) return null;

  const { data: customer, error: customerError } = await admin
    .from("customers")
    .select("name, email")
    .eq("id", invoice.customer_id)
    .eq("business_id", invoice.business_id)
    .maybeSingle();
  if (customerError) return null;
  const { data: business, error: businessError } = await admin
    .from("businesses")
    .select("name")
    .eq("id", invoice.business_id)
    .maybeSingle();
  if (businessError) return null;

  return { ...invoice, customer, business };
}
