import type { ToolContext } from "./types.ts";
import type { Json } from "../../types/database.ts";

export type ActivityStatus = "started" | "completed" | "failed";

function safeInputSummary(value: unknown): Json {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const summary: Record<string, string | number> = {};
  for (const key of ["invoice_id", "customer_id"]) {
    const candidate = input[key];
    if (typeof candidate === "string" && /^[0-9a-f-]{36}$/i.test(candidate)) summary[key] = candidate;
  }
  if (typeof input.limit === "number" && Number.isInteger(input.limit)) summary.limit = input.limit;
  if (typeof input.status === "string" && ["draft", "pending", "paid", "cancelled"].includes(input.status)) summary.status = input.status;
  if (typeof input.tone === "string" && ["friendly", "firm", "formal"].includes(input.tone)) summary.tone = input.tone;
  return summary;
}

function safeOutputSummary(value: unknown): Json {
  if (Array.isArray(value)) return { count: value.length };
  if (!value || typeof value !== "object") return {};
  const result = value as Record<string, unknown>;
  const summary: Record<string, string | number | boolean> = {};
  for (const key of ["count", "invoiceCount", "overdueCount", "chunkCount", "similarityCount"]) {
    if (typeof result[key] === "number" && Number.isFinite(result[key])) summary[key] = result[key] as number;
  }
  if (typeof result.hasMore === "boolean") summary.hasMore = result.hasMore;
  return summary;
}

export async function recordToolActivity(input: {
  context: ToolContext;
  callId: string;
  toolName: string;
  status: ActivityStatus;
  toolInput?: unknown;
  toolOutput?: unknown;
  durationMs?: number;
}) {
  const inputSummary = input.status === "started" ? {} : safeInputSummary(input.toolInput);
  const outputSummary = input.status === "completed" ? safeOutputSummary(input.toolOutput) : {};
  const entityId = typeof input.toolInput === "object" && input.toolInput && !Array.isArray(input.toolInput)
    ? (input.toolInput as Record<string, unknown>).invoice_id
    : undefined;
  const invoiceToolNames = new Set(["draft_payment_reminder", "create_approval_request", "get_paypal_payment_status"]);

  const { error } = await input.context.supabase.rpc("record_agent_activity", {
    p_business_id: input.context.businessId,
    p_conversation_id: input.context.conversationId,
    p_tool_call_id: input.callId,
    p_tool_name: input.toolName,
    p_status: input.status,
    p_entity_type: invoiceToolNames.has(input.toolName) && typeof entityId === "string" ? "invoice" : null,
    p_entity_id: invoiceToolNames.has(input.toolName) && typeof entityId === "string" ? entityId : null,
    p_input_summary: inputSummary,
    p_output_summary: outputSummary,
    p_duration_ms: Math.max(0, Math.floor(input.durationMs ?? 0)),
  });
  if (error) {
    console.error("Agent activity record failed", { toolName: input.toolName, code: error.code });
    throw new Error("LedgerLoop could not save the agent activity record, so this tool result was withheld.");
  }
}
