import { findCheckoutInvoice } from "@/lib/paypal/checkout";
import { PayPalRequestError, paypalRequest } from "@/lib/paypal/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";

type PayPalOrder = { id?: string; status?: string };
const CANCELLABLE_STATUSES = ["created", "pending_approval"] as const;

export async function POST(request: Request) {
  let body: { token?: unknown; orderID?: unknown };
  try {
    body = (await request.json()) as { token?: unknown; orderID?: unknown };
  } catch {
    return Response.json({ error: "A valid checkout cancellation is required." }, { status: 400 });
  }
  if (typeof body.token !== "string" || typeof body.orderID !== "string" || !/^[A-Za-z0-9_-]{5,64}$/.test(body.orderID)) {
    return Response.json({ error: "A valid checkout cancellation is required." }, { status: 400 });
  }
  if (!hasSupabaseAdminConfig()) return Response.json({ error: "PayPal checkout is not configured on this server." }, { status: 503 });

  let invoice;
  try {
    invoice = await findCheckoutInvoice(body.token);
  } catch (error) {
    console.error("PayPal cancellation could not load the invoice", error);
    return Response.json({ error: "Payment service is not ready. Apply the database migration and try again." }, { status: 503 });
  }
  if (!invoice) return Response.json({ error: "This payment link is invalid or has expired." }, { status: 404 });

  const admin = createAdminClient();
  const { data: attempt, error: attemptError } = await admin
    .from("payment_attempts")
    .select("id, status, provider_order_id, provider_capture_id")
    .eq("business_id", invoice.business_id)
    .eq("invoice_id", invoice.id)
    .eq("provider_order_id", body.orderID)
    .maybeSingle();
  if (attemptError || !attempt) return Response.json({ error: "This PayPal order does not belong to the invoice." }, { status: 404 });
  if (attempt.status === "captured" && attempt.provider_capture_id) {
    return Response.json({ status: "captured", captureID: attempt.provider_capture_id });
  }
  if (!(CANCELLABLE_STATUSES as readonly string[]).includes(attempt.status)) {
    return Response.json({ status: "pending", message: "This order may already be approved. Return to checkout to resume safely." });
  }

  try {
    const order = await paypalRequest<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(body.orderID)}`, { method: "GET" });
    if (order.id !== body.orderID) return Response.json({ error: "PayPal order reference did not match." }, { status: 409 });
    if (order.status !== "CREATED" && order.status !== "VOIDED") {
      return Response.json({ status: "pending", message: "PayPal has not confirmed a cancellable order. Return to checkout to resume safely." });
    }

    const { data: cancelled, error } = await admin.from("payment_attempts")
      .update({ status: "cancelled" })
      .eq("id", attempt.id)
      .in("status", [...CANCELLABLE_STATUSES])
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("PayPal cancellation could not be recorded", error);
      return Response.json({ error: "Checkout closed, but its state could not be recorded. Return to this page to resume safely." }, { status: 503 });
    }
    return Response.json({ status: cancelled ? "cancelled" : "pending" });
  } catch (error) {
    console.error("PayPal cancellation status lookup failed", error instanceof PayPalRequestError ? { status: error.status, message: error.message } : error);
    return Response.json({ error: "PayPal could not confirm the order state. Return to this page to resume safely." }, { status: 503 });
  }
}
