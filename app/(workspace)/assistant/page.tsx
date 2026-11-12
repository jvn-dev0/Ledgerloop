import { AgentWorkspace } from "@/components/agent/agent-workspace";
import { requireWorkspace } from "@/lib/data/workspace";

export default async function CollectionsPage() {
  const { supabase, business } = await requireWorkspace();
  const [conversationResult, documentResult, approvalResult, activityResult] = await Promise.all([
    supabase.from("agent_conversations").select("id").eq("business_id", business.id).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("knowledge_documents").select("id, name, mime_type, chunk_count, updated_at").eq("business_id", business.id).order("updated_at", { ascending: false }).limit(50),
    supabase.from("approval_requests").select("id, invoice_id, action_type, status, reason, result, created_at, expires_at").eq("business_id", business.id).order("created_at", { ascending: false }).limit(12),
    supabase.from("agent_activity").select("id, tool_name, status, duration_ms, created_at").eq("business_id", business.id).order("created_at", { ascending: false }).limit(20),
  ]);
  const databaseReady = !conversationResult.error && !documentResult.error && !approvalResult.error && !activityResult.error;
  if (!databaseReady) {
    console.error("Collections workspace could not load Day 3 data", {
      conversation: conversationResult.error?.code,
      documents: documentResult.error?.code,
      approvals: approvalResult.error?.code,
      activity: activityResult.error?.code,
    });
  }

  const conversationId = conversationResult.data?.id ?? null;
  const messageResult = conversationId
    ? await supabase.from("agent_messages").select("id, role, content").eq("business_id", business.id).eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(30)
    : { data: [], error: null };
  const ready = databaseReady && !messageResult.error;
  const invoiceIds = [...new Set((approvalResult.data ?? []).map((approval) => approval.invoice_id))];
  const invoiceResult = invoiceIds.length
    ? await supabase.from("invoices").select("id, invoice_number").eq("business_id", business.id).in("id", invoiceIds)
    : { data: [], error: null };
  const invoiceNumberById = new Map((invoiceResult.data ?? []).map((invoice) => [invoice.id, invoice.invoice_number]));

  return <AgentWorkspace
    businessName={business.name}
    databaseReady={ready}
    initialConversationId={conversationId}
    initialMessages={(messageResult.data ?? []).map((message) => ({ id: message.id, role: message.role, content: message.content }))}
    initialDocuments={(documentResult.data ?? []).map((document) => ({ ...document }))}
    initialApprovals={(approvalResult.data ?? []).map((approval) => ({
      ...approval,
      invoice_number: invoiceNumberById.get(approval.invoice_id) ?? "Invoice",
    }))}
    initialActivity={(activityResult.data ?? []).map((item) => ({ ...item }))}
  />;
}
