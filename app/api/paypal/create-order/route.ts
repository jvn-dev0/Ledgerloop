import { randomUUID } from "node:crypto";
import { findCheckoutInvoice } from "@/lib/paypal/checkout";
import { toPayPalAmount } from "@/lib/paypal/amount";
import { PayPalRequestError, paypalRequest } from "@/lib/paypal/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";

type PayPalOrder = { id?: string; status?: string };
const ACTIVE_STATUSES = ["created", "pending_approval", "approved"] as const;

export async function POST(request: Request) {
  let body: { token?: unknown };
  try {
    body = (await request.json()) as { token?: unknown };
  } catch {
    return Response.json({ error: "A valid payment link is required." }, { status: 400 });
  }
  if (typeof body.token !== "string") return Response.json({ error: "A valid payment link is required." }, { status: 400 });
  if (!hasSupabaseAdminConfig()) return Response.json({ error: "PayPal checkout is not configured on this server." }, { status: 503 });

  let invoice;
  try {
    invoice = await findCheckoutInvoice(body.token);
  } catch (error) {
    console.error("PayPal checkout could not load the invoice", error);
    return Response.json({ error: "Payment service is not ready. Apply the database migration and try again." }, { status: 503 });
  }
  if (!invoice) return Response.json({ error: "This payment link is invalid or has expired." }, { status: 404 });
  if (invoice.status !== "pending") return Response.json({ error: "This invoice is not available for payment." }, { status: 409 });

  const amount = toPayPalAmount(invoice.amount, invoice.currency);
  if (!amount) return Response.json({ error: "This invoice amount cannot be represented in PayPal for its currency." }, { status: 422 });

  const admin = createAdminClient();
  const { data: existingAttempt, error: attemptError } = await admin
    .from("payment_attempts")
    .select("id, provider_order_id, status, idempotency_key, amount, currency")
    .eq("business_id", invoice.business_id)
    .eq("invoice_id", invoice.id)
    .in("status", [...ACTIVE_STATUSES])
    .maybeSingle();
  let attempt = existingAttempt;

  if (attemptError) {
    console.error("Payment attempt lookup failed", attemptError);
    return Response.json({ error: "Payment could not be started. Try again." }, { status: 503 });
  }
  if (attempt?.provider_order_id) return Response.json({ orderID: attempt.provider_order_id });
  if (!attempt) {
    const { data: created, error } = await admin
      .from("payment_attempts")
      .insert({
        business_id: invoice.business_id,
        invoice_id: invoice.id,
        provider: "paypal",
        amount: invoice.amount,
        currency: invoice.currency,
        status: "created",
        idempotency_key: randomUUID(),
      })
      .select("id, provider_order_id, status, idempotency_key, amount, currency")
      .maybeSingle();

    if (error?.code === "23505") {
      const retry = await admin.from("payment_attempts").select("id, provider_order_id, status, idempotency_key, amount, currency").eq("business_id", invoice.business_id).eq("invoice_id", invoice.id).in("status", [...ACTIVE_STATUSES]).maybeSingle();
      if (retry.data?.provider_order_id) return Response.json({ orderID: retry.data.provider_order_id });
      return Response.json({ error: "Checkout is already starting. Please try again in a moment." }, { status: 409 });
    }
    if (error || !created) {
      console.error("Payment attempt could not be saved", error);
      return Response.json({ error: "Payment could not be started. Try again." }, { status: 503 });
    }
    attempt = created;
  }

  const expectedAmount = toPayPalAmount(attempt.amount, attempt.currency);
  if (!expectedAmount || expectedAmount !== amount || attempt.currency !== invoice.currency) {
    return Response.json({ error: "The saved payment attempt no longer matches this invoice." }, { status: 409 });
  }

  try {
    const order = await paypalRequest<PayPalOrder>("/v2/checkout/orders", {
      method: "POST",
      requestId: attempt.idempotency_key,
      body: {
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: invoice.id,
          custom_id: attempt.id,
          invoice_id: invoice.invoice_number,
          description: invoice.description.slice(0, 127),
          amount: { currency_code: invoice.currency, value: amount },
        }],
        application_context: { user_action: "PAY_NOW" },
      },
    });
    if (!order.id) throw new Error("PayPal did not return an order reference.");

    const { error: updateError } = await admin.from("payment_attempts").update({
      provider_order_id: order.id,
      status: "pending_approval",
    }).eq("id", attempt.id).is("provider_order_id", null);
    if (updateError) {
      console.error("PayPal order reference could not be saved", updateError);
      return Response.json({ error: "PayPal created an order but LedgerLoop could not save its reference. Retry checkout." }, { status: 503 });
    }
    return Response.json({ orderID: order.id });
  } catch (error) {
    const status = error instanceof PayPalRequestError ? 502 : 503;
    console.error("PayPal order creation failed", error instanceof PayPalRequestError ? { status: error.status, message: error.message } : error);
    return Response.json({ error: error instanceof Error ? error.message : "PayPal could not start checkout." }, { status });
  }
}
