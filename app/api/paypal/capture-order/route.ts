import { findCheckoutInvoice } from "@/lib/paypal/checkout";
import { toPayPalAmount } from "@/lib/paypal/amount";
import { PayPalRequestError, paypalRequest } from "@/lib/paypal/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";

type PayPalCapture = { id?: string; status?: string; amount?: { value?: string; currency_code?: string } };
type PayPalOrder = {
  id?: string;
  status?: string;
  purchase_units?: Array<{ payments?: { captures?: PayPalCapture[] } }>;
};

export async function POST(request: Request) {
  let body: { token?: unknown; orderID?: unknown };
  try {
    body = (await request.json()) as { token?: unknown; orderID?: unknown };
  } catch {
    return Response.json({ error: "A valid checkout confirmation is required." }, { status: 400 });
  }
  if (typeof body.token !== "string" || typeof body.orderID !== "string" || !/^[A-Za-z0-9_-]{5,64}$/.test(body.orderID)) {
    return Response.json({ error: "A valid checkout confirmation is required." }, { status: 400 });
  }
  if (!hasSupabaseAdminConfig()) return Response.json({ error: "PayPal checkout is not configured on this server." }, { status: 503 });

  let invoice;
  try {
    invoice = await findCheckoutInvoice(body.token);
  } catch (error) {
    console.error("PayPal capture could not load the invoice", error);
    return Response.json({ error: "Payment service is not ready. Apply the database migration and try again." }, { status: 503 });
  }
  if (!invoice) return Response.json({ error: "This payment link is invalid or has expired." }, { status: 404 });

  const admin = createAdminClient();
  const { data: attempt, error: attemptError } = await admin
    .from("payment_attempts")
    .select("id, provider_order_id, provider_capture_id, status, amount, currency")
    .eq("business_id", invoice.business_id)
    .eq("invoice_id", invoice.id)
    .eq("provider_order_id", body.orderID)
    .maybeSingle();
  if (attemptError || !attempt) return Response.json({ error: "This PayPal order does not belong to the invoice." }, { status: 404 });
  if (attempt.status === "captured" && attempt.provider_capture_id) {
    return Response.json({ status: "COMPLETED", captureID: attempt.provider_capture_id, alreadyCaptured: true });
  }
  if (attempt.status === "failed" || attempt.status === "cancelled" || invoice.status !== "pending") {
    return Response.json({ error: "This payment attempt is no longer eligible for capture." }, { status: 409 });
  }

  const expectedAmount = toPayPalAmount(attempt.amount, attempt.currency);
  if (!expectedAmount || attempt.currency !== invoice.currency || attempt.amount !== invoice.amount) {
    return Response.json({ error: "The payment attempt does not match the invoice amount and currency." }, { status: 409 });
  }

  try {
    await admin.from("payment_attempts").update({ status: "approved" }).eq("id", attempt.id).in("status", ["created", "pending_approval", "approved"]);

    let order: PayPalOrder;
    try {
      order = await paypalRequest<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(body.orderID)}/capture`, {
        method: "POST",
        requestId: attempt.id,
        body: {},
      });
    } catch (error) {
      if (!(error instanceof PayPalRequestError) || error.status !== 422) throw error;
      // A retried capture can be reported by PayPal as already captured.
      order = await paypalRequest<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(body.orderID)}`, { method: "GET" });
    }

    if (order.id !== body.orderID || order.status !== "COMPLETED") {
      return Response.json({ status: order.status ?? "PENDING", error: "PayPal has not completed this payment." }, { status: 202 });
    }
    const capture = order.purchase_units?.flatMap((unit) => unit.payments?.captures ?? []).find((item) => item.status === "COMPLETED");
    if (!capture?.id || !capture.amount?.value || !capture.amount.currency_code) {
      return Response.json({ error: "PayPal did not return a completed capture." }, { status: 502 });
    }
    const capturedAmount = toPayPalAmount(capture.amount.value, capture.amount.currency_code);
    if (capturedAmount !== expectedAmount || capture.amount.currency_code !== attempt.currency) {
      console.error("PayPal capture amount mismatch", { attemptId: attempt.id, currency: capture.amount.currency_code });
      return Response.json({ error: "PayPal's captured amount did not match the invoice." }, { status: 409 });
    }

    const { data: finalized, error: finalizeError } = await admin.rpc("finalize_paypal_payment", {
      p_attempt_id: attempt.id,
      p_order_id: body.orderID,
      p_capture_id: capture.id,
      p_amount: capture.amount.value,
      p_currency: capture.amount.currency_code,
    });
    if (finalizeError) {
      console.error("Verified PayPal capture could not be reconciled", finalizeError);
      return Response.json({ error: "PayPal captured the payment, but LedgerLoop could not reconcile it. Contact the business owner." }, { status: 503 });
    }
    return Response.json({ status: "COMPLETED", captureID: capture.id, alreadyCaptured: finalized === false });
  } catch (error) {
    console.error("PayPal capture failed", error instanceof PayPalRequestError ? { status: error.status, message: error.message } : error);
    return Response.json({ error: error instanceof Error ? error.message : "PayPal could not capture this payment." }, { status: 502 });
  }
}
