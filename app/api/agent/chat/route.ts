import { z } from "zod";
import { requireWorkspace } from "@/lib/data/workspace";
import { createGroqModelProvider, ProviderError } from "@/lib/agent/model-client";
import { runAgent } from "@/lib/agent/orchestrator";
import { getToolDefinitions } from "@/lib/agent/tools";
import type { ToolContext, ToolExecutionEvent } from "@/lib/agent/types";
import { readRequestBodyWithinLimit } from "@/lib/http/request-body";

export const runtime = "nodejs";
export const maxDuration = 120;

const inputSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  conversationId: z.string().uuid().optional(),
}).strict();

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function providerError(error: unknown) {
  if (!(error instanceof ProviderError)) return { error: "The assistant could not complete this request. Please try again.", status: 503 };
  if (error.code === "rate_limited") return { error: error.message, status: 429 };
  if (error.code === "timeout" || error.code === "unavailable" || error.code === "configuration") return { error: error.message, status: 503 };
  return { error: error.message, status: 502 };
}

function evidenceFrom(results: Array<{ name: string; data: unknown }>) {
  const drafts = results.filter((result) => result.name === "draft_payment_reminder").map((result) => result.data).slice(0, 3);
  const prioritized = results.filter((result) => result.name === "prioritize_collections").map((result) => {
    const data = result.data as { asOf?: string; limitedToOldest100?: boolean; prioritized?: unknown[] };
    return { asOf: data.asOf, limitedToOldest100: data.limitedToOldest100, prioritized: data.prioritized?.slice(0, 10) ?? [] };
  }).slice(0, 1);
  const summaries = results.filter((result) => ["get_business_summary", "calculate_receivables"].includes(result.name)).map((result) => result.data).slice(0, 1);
  return { drafts, prioritized, summaries };
}

export async function POST(request: Request) {
  const boundedBody = await readRequestBodyWithinLimit(request, 8 * 1024);
  if (!boundedBody.ok) {
    return errorResponse(
      boundedBody.reason === "too_large" ? "Request body is too large." : "The request could not be read.",
      boundedBody.reason === "too_large" ? 413 : 400,
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(boundedBody.bytes));
  } catch {
    return errorResponse("Send a valid JSON request.", 400);
  }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Enter a request between 1 and 2,000 characters.", 400);

  const { supabase, business, ownerId } = await requireWorkspace();
  let conversationId = parsed.data.conversationId;
  if (conversationId) {
    const { data, error } = await supabase.from("agent_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("business_id", business.id)
      .maybeSingle();
    if (error) {
      console.error("Agent conversation lookup failed", { code: error.code });
      return errorResponse("Apply the Day 3 database migration before starting a collections conversation.", 503);
    }
    if (!data) return errorResponse("Conversation was not found in this business.", 404);
  } else {
    const { data, error } = await supabase.from("agent_conversations").insert({
      business_id: business.id,
      created_by: ownerId,
      title: parsed.data.message.slice(0, 80),
    }).select("id").maybeSingle();
    if (error || !data) {
      console.error("Agent conversation creation failed", { code: error?.code });
      return errorResponse("Apply the Day 3 database migration before starting a collections conversation.", 503);
    }
    conversationId = data.id;
  }

  const { data: userMessage, error: messageError } = await supabase.from("agent_messages").insert({
    business_id: business.id,
    conversation_id: conversationId,
    role: "user",
    content: parsed.data.message,
  }).select("id").maybeSingle();
  if (messageError || !userMessage) {
    console.error("Agent user message could not be saved", { code: messageError?.code });
    return errorResponse("Your message could not be saved. Check the Day 3 database migration and try again.", 503);
  }

  const { data: historyRows, error: historyError } = await supabase.from("agent_messages")
    .select("id, role, content")
    .eq("business_id", business.id)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(11);
  if (historyError) {
    console.error("Agent conversation history could not be loaded", { code: historyError.code });
    return errorResponse("Conversation history could not be loaded. Please try again.", 503);
  }
  const history = (historyRows ?? []).filter((row) => row.id !== userMessage.id && (row.role === "user" || row.role === "assistant"))
    .reverse().map((row) => ({ role: row.role as "user" | "assistant", content: row.content }));
  const now = new Date();
  const context: ToolContext = {
    supabase,
    businessId: business.id,
    businessName: business.name,
    businessCurrency: business.default_currency,
    ownerId,
    conversationId,
    today: now.toISOString().slice(0, 10),
  };

  const encoder = new TextEncoder();
  const abortController = new AbortController();
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      send({ type: "conversation", conversationId });
      try {
        const provider = createGroqModelProvider();
        const result = await runAgent({
          message: parsed.data.message,
          history,
          provider,
          tools: getToolDefinitions(),
          context,
          signal: abortController.signal,
          onEvent: async (event: ToolExecutionEvent) => send({ type: "tool", event }),
        });
        const metadata = {
          model: provider.modelId,
          iterations: result.iterations,
          stoppedAtLimit: result.stoppedAtLimit,
          tokenUsage: result.usage,
        };
        const { error: assistantError } = await supabase.from("agent_messages").insert({
          business_id: business.id,
          conversation_id: conversationId,
          role: "assistant",
          content: result.answer,
          metadata,
        });
        if (assistantError) {
          console.error("Agent response could not be saved", { code: assistantError.code });
          send({ type: "error", error: "The analysis finished, but LedgerLoop could not save the response. Try again." });
        } else {
          await supabase.from("agent_conversations").update({ updated_at: new Date().toISOString() })
            .eq("id", conversationId)
            .eq("business_id", business.id);
          send({ type: "result", answer: result.answer, evidence: evidenceFrom(result.toolResults), metadata });
        }
      } catch (error) {
        const response = providerError(error);
        console.error("Collections agent request failed", error instanceof ProviderError
          ? { code: error.code, status: error.status }
          : { name: error instanceof Error ? error.name : "unknown" });
        send({ type: "error", error: response.error, status: response.status });
      } finally {
        if (!closed) controller.close();
      }
    },
    cancel() {
      closed = true;
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
