"use server";

import { randomBytes } from "node:crypto";
import { requireWorkspace } from "@/lib/data/workspace";
import { hashPaymentLinkToken } from "@/lib/paypal/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";

export type PaymentLinkState = { error?: string; url?: string };

export async function createInvoicePaymentLink(
  invoiceId: string,
  previousState: PaymentLinkState,
  formData: FormData,
): Promise<PaymentLinkState> {
  void previousState;
  void formData;
  const { supabase, business, ownerId } = await requireWorkspace();
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, status")
    .eq("id", invoiceId)
    .eq("business_id", business.id)
    .maybeSingle();

  if (invoiceError || !invoice) return { error: "Invoice was not found in this business." };
  if (invoice.status !== "pending") return { error: "Only pending invoices can have a payment link." };
  if (!hasSupabaseAdminConfig()) return { error: "Add SUPABASE_SERVICE_ROLE_KEY to .env.local before creating payment links." };

  const configuredUrl = process.env.APP_URL?.trim() || "http://localhost:3000";
  let origin: string;
  try {
    const appUrl = new URL(configuredUrl);
    if (process.env.NODE_ENV === "production" && appUrl.protocol !== "https:") {
      return { error: "APP_URL must use HTTPS in production." };
    }
    origin = appUrl.origin;
  } catch {
    return { error: "APP_URL must be a valid application URL." };
  }

  const token = randomBytes(32).toString("base64url");
  const admin = createAdminClient();
  const { error } = await admin.from("invoice_payment_links").upsert(
    {
      invoice_id: invoice.id,
      business_id: business.id,
      token_hash: hashPaymentLinkToken(token),
      created_by: ownerId,
      created_at: new Date().toISOString(),
      revoked_at: null,
    },
    { onConflict: "invoice_id" },
  );

  if (error) {
    console.error("Invoice payment link could not be saved", error);
    return { error: "We could not create the payment link. Apply the Day 2 migration and try again." };
  }

  return { url: new URL(`/pay/${token}`, origin).toString() };
}
