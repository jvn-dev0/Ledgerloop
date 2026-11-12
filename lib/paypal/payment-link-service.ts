import "server-only";
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { hashPaymentLinkToken } from "./server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";

function getAppOrigin() {
  const configuredUrl = process.env.APP_URL?.trim() || "http://localhost:3008";
  let appUrl: URL;
  try {
    appUrl = new URL(configuredUrl);
  } catch {
    throw new Error("APP_URL must be a valid application URL.");
  }
  if (process.env.NODE_ENV === "production" && appUrl.protocol !== "https:") {
    throw new Error("APP_URL must use HTTPS in production.");
  }
  return appUrl.origin;
}

export async function createInvoicePaymentLinkForOwner(input: {
  supabase: SupabaseClient<Database>;
  businessId: string;
  ownerId: string;
  invoiceId: string;
}) {
  const { data: invoice, error: invoiceError } = await input.supabase
    .from("invoices")
    .select("id, status")
    .eq("id", input.invoiceId)
    .eq("business_id", input.businessId)
    .maybeSingle();
  if (invoiceError || !invoice) throw new Error("Invoice was not found in this business.");
  if (invoice.status !== "pending") throw new Error("Only pending invoices can have a payment link.");
  if (!hasSupabaseAdminConfig()) throw new Error("Add SUPABASE_SECRET_KEY to .env.local before creating payment links.");

  const origin = getAppOrigin();
  const token = randomBytes(32).toString("base64url");
  const admin = createAdminClient();
  const { error } = await admin.from("invoice_payment_links").upsert({
    invoice_id: invoice.id,
    business_id: input.businessId,
    token_hash: hashPaymentLinkToken(token),
    created_by: input.ownerId,
    created_at: new Date().toISOString(),
    revoked_at: null,
  }, { onConflict: "invoice_id" });
  if (error) {
    console.error("Invoice payment link could not be saved", { code: error.code });
    throw new Error("We could not create the payment link. Check the Day 2 database migration and try again.");
  }
  return { url: new URL(`/pay/${token}`, origin).toString() };
}
