import { requireWorkspace } from "@/lib/data/workspace";

export async function GET() {
  const { supabase, business } = await requireWorkspace();
  const [documentResult, approvalResult, activityResult] = await Promise.all([
    supabase.from("knowledge_documents").select("id, name, mime_type, chunk_count, updated_at").eq("business_id", business.id).order("updated_at", { ascending: false }).limit(50),
    supabase.from("approval_requests").select("id, invoice_id, action_type, status, reason, result, created_at, expires_at").eq("business_id", business.id).order("created_at", { ascending: false }).limit(12),
    supabase.from("agent_activity").select("id, tool_name, status, duration_ms, created_at").eq("business_id", business.id).order("created_at", { ascending: false }).limit(20),
  ]);
  if (documentResult.error || approvalResult.error || activityResult.error) {
    console.error("Collections workspace state refresh failed", {
      documents: documentResult.error?.code,
      approvals: approvalResult.error?.code,
      activity: activityResult.error?.code,
    });
    return Response.json({ error: "Collections workspace state could not be refreshed." }, { status: 503 });
  }

  const invoiceIds = [...new Set((approvalResult.data ?? []).map((approval) => approval.invoice_id))];
  const invoiceResult = invoiceIds.length
    ? await supabase.from("invoices").select("id, invoice_number").eq("business_id", business.id).in("id", invoiceIds)
    : { data: [], error: null };
  if (invoiceResult.error) return Response.json({ error: "Approval details could not be loaded." }, { status: 503 });
  const invoiceNumberById = new Map((invoiceResult.data ?? []).map((invoice) => [invoice.id, invoice.invoice_number]));
  return Response.json({
    documents: documentResult.data ?? [],
    approvals: (approvalResult.data ?? []).map((approval) => ({ ...approval, invoice_number: invoiceNumberById.get(approval.invoice_id) ?? "Invoice" })),
    activity: activityResult.data ?? [],
  });
}
