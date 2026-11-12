import { toPayPalAmount } from "@/lib/paypal/amount";
import { PayPalRequestError, verifyPayPalWebhook } from "@/lib/paypal/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";

type WebhookEvent = {
  id?: unknown;
  event_type?: unknown;
  resource?: {
    id?: unknown;
    status?: unknown;
    amount?: { value?: unknown; currency_code?: unknown };
    supplementary_data?: { related_ids?: { order_id?: unknown } };
  };
};

export async function POST(request: Request) {
  if (!hasSupabaseAdminConfig()) return Response.json({ error: "Webhook processing is not configured." }, { status: 503 });

  let event: WebhookEvent;
  try {
    event = JSON.parse(await request.text()) as WebhookEvent;
  } catch {
    return Response.json({ error: "Invalid webhook payload." }, { status: 400 });
  }
  if (typeof event.id !== "string" || typeof event.event_type !== "string" || !event.id || !event.event_type) {
    return Response.json({ error: "Invalid webhook event." }, { status: 400 });
  }

  let verified: boolean;
  try {
    verified = await verifyPayPalWebhook(event, request.headers);
  } catch (error) {
    console.error("PayPal webhook verification is unavailable", error instanceof PayPalRequestError ? { status: error.status, message: error.message } : error);
    return Response.json({ error: "Webhook signature verification could not be completed." }, { status: 503 });
  }
  if (!verified) return Response.json({ error: "PayPal webhook signature is invalid." }, { status: 400 });

  const admin = createAdminClient();
  const resource = event.resource;
  const resourceId = typeof resource?.id === "string" ? resource.id : null;
  const { error: insertError } = await admin.from("paypal_webhook_events").insert({
    event_id: event.id,
    event_type: event.event_type,
    resource_id: resourceId,
    status: "processing",
  });

  if (insertError?.code === "23505") {
    const existing = await admin.from("paypal_webhook_events").select("status, received_at").eq("event_id", event.id).maybeSingle();
    if (existing.error || !existing.data) return Response.json({ error: "Webhook event state could not be loaded." }, { status: 503 });

    const staleBefore = new Date(Date.now() - 5 * 60_000).toISOString();
    const failed = existing.data.status === "failed";
    const staleProcessing = existing.data.status === "processing" && existing.data.received_at < staleBefore;
    if (!failed && !staleProcessing) return Response.json({ received: true, duplicate: true });

    const retryQuery = admin.from("paypal_webhook_events").update({
      status: "processing",
      received_at: new Date().toISOString(),
      result_detail: null,
      processed_at: null,
    }).eq("event_id", event.id);
    if (failed) retryQuery.eq("status", "failed");
    else retryQuery.eq("status", "processing").lt("received_at", staleBefore);
    const retry = await retryQuery.select("event_id").maybeSingle();
    if (retry.error) return Response.json({ error: "Webhook event could not be retried." }, { status: 503 });
    if (!retry.data) return Response.json({ received: true, duplicate: true });
  } else if (insertError) {
    console.error("PayPal webhook event could not be recorded", insertError);
    return Response.json({ error: "Webhook event could not be recorded." }, { status: 503 });
  }

  try {
    if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      const orderId = resource?.supplementary_data?.related_ids?.order_id;
      const amount = resource?.amount?.value;
      const currency = resource?.amount?.currency_code;
      const captureId = resourceId;
      if (typeof orderId !== "string" || typeof amount !== "string" || typeof currency !== "string" || !captureId) {
        throw new Error("Completed capture event is missing a required payment reference.");
      }

      const { data: attempt, error: attemptError } = await admin
        .from("payment_attempts")
        .select("id, amount, currency")
        .eq("provider", "paypal")
        .eq("provider_order_id", orderId)
        .maybeSingle();
      if (attemptError) throw new Error("The matching payment attempt could not be loaded.");
      if (!attempt) {
        await finishEvent(admin, event.id, "ignored", "No LedgerLoop order matched this PayPal capture.");
        return Response.json({ received: true });
      }

      const receivedAmount = toPayPalAmount(amount, currency);
      const expectedAmount = toPayPalAmount(attempt.amount, attempt.currency);
      if (!receivedAmount || receivedAmount !== expectedAmount || currency !== attempt.currency) {
        throw new Error("PayPal capture amount or currency does not match the stored payment attempt.");
      }

      const { error: finalizeError } = await admin.rpc("finalize_paypal_payment", {
        p_attempt_id: attempt.id,
        p_order_id: orderId,
        p_capture_id: captureId,
        p_amount: amount,
        p_currency: currency,
      });
      if (finalizeError) throw new Error("The verified PayPal capture could not be reconciled.");
      await finishEvent(admin, event.id, "processed", "Verified completed capture reconciled.");
      return Response.json({ received: true });
    }

    if (event.event_type === "PAYMENT.CAPTURE.DENIED") {
      const orderId = resource?.supplementary_data?.related_ids?.order_id;
      if (typeof orderId === "string") {
        const { data: failedAttempt, error: deniedError } = await admin.from("payment_attempts").update({ status: "failed" })
          .eq("provider", "paypal")
          .eq("provider_order_id", orderId)
          .in("status", ["created", "pending_approval", "approved"])
          .select("id")
          .maybeSingle();
        if (deniedError) throw new Error("The denied PayPal capture could not be recorded.");
        if (!failedAttempt) {
          await finishEvent(admin, event.id, "ignored", "No eligible LedgerLoop payment attempt matched this denial.");
          return Response.json({ received: true });
        }
      } else {
        await finishEvent(admin, event.id, "ignored", "The denied capture did not include a related LedgerLoop order reference.");
        return Response.json({ received: true });
      }
      await finishEvent(admin, event.id, "processed", "Denied capture recorded; invoice remains unpaid.");
      return Response.json({ received: true });
    }

    await finishEvent(admin, event.id, "ignored", "Event type is not used for invoice reconciliation.");
    return Response.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook reconciliation failed.";
    console.error("Verified PayPal webhook could not be reconciled", { eventId: event.id, eventType: event.event_type, message });
    await finishEvent(admin, event.id, "failed", message.slice(0, 500));
    return Response.json({ error: "Verified webhook could not be reconciled." }, { status: 503 });
  }
}

async function finishEvent(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  status: "processed" | "ignored" | "failed",
  detail: string,
) {
  const { error } = await admin.from("paypal_webhook_events").update({
    status,
    result_detail: detail,
    processed_at: new Date().toISOString(),
  }).eq("event_id", eventId);
  if (error) throw new Error("Webhook event result could not be saved.");
}
