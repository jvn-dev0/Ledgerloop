import { z } from "zod";
import { requireWorkspace } from "@/lib/data/workspace";
import { createInvoicePaymentLinkForOwner } from "@/lib/paypal/payment-link-service";
import { createAdminClient } from "@/lib/supabase/admin";

const decisionSchema = z.object({ decision: z.enum(["approve", "reject"]) }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return Response.json({ error: "Approval identifier is invalid." }, { status: 400 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Choose approve or reject." }, { status: 400 });
  }
  const parsed = decisionSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Choose approve or reject." }, { status: 400 });

  const { supabase, business, ownerId } = await requireWorkspace();
  const { data: approval, error: readError } = await supabase.from("approval_requests")
    .select("id, invoice_id, action_type, status, reason, expires_at")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();
  if (readError) {
    console.error("Approval request lookup failed", { code: readError.code });
    return Response.json({ error: "Approval requests are unavailable. Apply the Day 3 migration and try again." }, { status: 503 });
  }
  if (!approval) return Response.json({ error: "Approval request was not found in this business." }, { status: 404 });
  if (approval.status !== "pending") return Response.json({ error: "This request has already been decided or is no longer available." }, { status: 409 });

  const admin = createAdminClient();
  const decidedAt = new Date().toISOString();
  if (Date.parse(approval.expires_at) <= Date.now()) {
    const { data: expired, error: expiryError } = await admin.from("approval_requests")
      .update({ status: "expired", decided_by: ownerId, decided_at: decidedAt })
      .eq("id", approval.id).eq("business_id", business.id).eq("status", "pending")
      .select("id").maybeSingle();
    if (expiryError) {
      console.error("Expired approval request could not be updated", { code: expiryError.code });
      return Response.json({ error: "The expired request status could not be saved. Refresh and try again." }, { status: 503 });
    }
    if (!expired) return Response.json({ error: "This request has already been decided." }, { status: 409 });
    return Response.json({ error: "This approval request has expired." }, { status: 409 });
  }
  if (parsed.data.decision === "reject") {
    const { data, error } = await admin.from("approval_requests").update({
      status: "rejected",
      decided_by: ownerId,
      decided_at: decidedAt,
    }).eq("id", approval.id).eq("business_id", business.id).eq("status", "pending").select("id, status").maybeSingle();
    if (error || !data) {
      console.error("Approval rejection could not be recorded", { code: error?.code });
      return Response.json({ error: "The decision could not be saved. Refresh and try again." }, { status: 503 });
    }
    return Response.json({ status: "rejected" });
  }

  const { data: claimed, error: claimError } = await admin.from("approval_requests").update({
    status: "executing",
    decided_by: ownerId,
    decided_at: decidedAt,
  }).eq("id", approval.id).eq("business_id", business.id).eq("status", "pending").select("id").maybeSingle();
  if (claimError || !claimed) return Response.json({ error: "This request is already being processed." }, { status: 409 });

  try {
    if (approval.action_type !== "create_payment_link") throw new Error("This approved action is not supported.");
    const { url } = await createInvoicePaymentLinkForOwner({
      supabase,
      businessId: business.id,
      ownerId,
      invoiceId: approval.invoice_id,
    });
    const { error: finishError } = await admin.from("approval_requests").update({
      status: "executed",
      result: { paymentLink: url },
    }).eq("id", approval.id).eq("business_id", business.id).eq("status", "executing");
    if (finishError) {
      console.error("Approved payment link status could not be saved", { code: finishError.code });
      return Response.json({ error: "The payment link was prepared, but its approval record could not be completed. Check the invoice before retrying." }, { status: 503 });
    }
    return Response.json({ status: "executed", paymentLink: url });
  } catch (error) {
    await admin.from("approval_requests").update({
      status: "failed",
      result: { error: "The approved payment link could not be created. Review the invoice and try again." },
    }).eq("id", approval.id).eq("business_id", business.id).eq("status", "executing");
    return Response.json({ error: error instanceof Error ? error.message : "The approved action failed." }, { status: 503 });
  }
}
