import type { AgentMessage, ModelProvider, ModelTool, ToolContext, ToolDefinition, ToolExecutionEvent } from "./types.ts";
import { buildSystemPrompt } from "./system-prompt.ts";
import { ProviderError } from "./model-client.ts";
import { recordToolActivity } from "./telemetry.ts";

const MAX_USER_MESSAGE_LENGTH = 2000;
const MAX_TOOL_OUTPUT_LENGTH = 4000;
const DEFAULT_MAX_ITERATIONS = 5;

export type AgentRunResult = {
  answer: string;
  events: ToolExecutionEvent[];
  toolResults: Array<{ name: string; data: unknown }>;
  iterations: number;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  stoppedAtLimit: boolean;
};

function serialise(value: unknown) {
  try {
    const bound = (item: unknown, depth = 0): unknown => {
      if (typeof item === "string") return item.length > 500 ? `${item.slice(0, 500)}…[truncated]` : item;
      if (Array.isArray(item)) return item.slice(0, 8).map((child) => bound(child, depth + 1));
      if (!item || typeof item !== "object" || depth >= 4) return item;
      const entries = Object.entries(item as Record<string, unknown>).slice(0, 30).map(([key, child]) => [key, bound(child, depth + 1)]);
      return Object.fromEntries(entries);
    };
    const bounded = JSON.stringify(bound(value));
    return bounded.length <= MAX_TOOL_OUTPUT_LENGTH
      ? bounded
      : JSON.stringify({ ok: false, error: "The tool returned more detail than the assistant can safely process. Narrow the request." });
  } catch {
    return JSON.stringify({ ok: false, error: "The tool returned an unreadable result." });
  }
}

export async function runAgent(input: {
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  provider: ModelProvider;
  tools: ToolDefinition[];
  context: ToolContext;
  maxIterations?: number;
  signal?: AbortSignal;
  onEvent?: (event: ToolExecutionEvent) => void | Promise<void>;
}): Promise<AgentRunResult> {
  const userMessage = input.message.trim();
  if (!userMessage || userMessage.length > MAX_USER_MESSAGE_LENGTH) throw new Error("Enter a request between 1 and 2,000 characters.");
  const maxIterations = Math.max(1, Math.min(input.maxIterations ?? DEFAULT_MAX_ITERATIONS, 6));
  const modelTools: ModelTool[] = input.tools.map(({ name, description, parameters }) => ({ type: "function", function: { name, description, parameters } }));
  const toolMap = new Map(input.tools.map((tool) => [tool.name, tool]));
  const messages: AgentMessage[] = [
    { role: "system", content: buildSystemPrompt({ businessName: input.context.businessName, currency: input.context.businessCurrency, today: input.context.today }) },
    ...(input.history ?? []).slice(-10).map(({ role, content }) => ({ role, content: content.slice(0, 4000) })),
    { role: "user", content: userMessage },
  ];
  const events: ToolExecutionEvent[] = [];
  const toolResults: Array<{ name: string; data: unknown }> = [];
  const usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const reply = await input.provider.complete({ messages, tools: modelTools }, input.signal);
    if (reply.usage) {
      usage.promptTokens += reply.usage.promptTokens;
      usage.completionTokens += reply.usage.completionTokens;
      usage.totalTokens += reply.usage.totalTokens;
    }
    if (reply.toolCalls.length === 0) {
      const answer = reply.content?.trim();
      if (!answer) throw new ProviderError("The model returned neither an answer nor a tool call.", "invalid_response");
      return { answer, events, toolResults, iterations: iteration, usage, stoppedAtLimit: false };
    }

    messages.push({ role: "assistant", content: reply.content, tool_calls: reply.toolCalls });
    const outputs: string[] = [];
    for (const call of reply.toolCalls) {
      const tool = toolMap.get(call.function.name);
      const start = Date.now();
      const started: ToolExecutionEvent = { type: "tool_started", name: call.function.name, callId: call.id };
      events.push(started);
      await input.onEvent?.(started);

      if (!tool) {
        const event: ToolExecutionEvent = { type: "tool_failed", name: call.function.name, callId: call.id, elapsedMs: 0, message: "Tool is not available." };
        events.push(event);
        await input.onEvent?.(event);
        outputs.push(serialise({ ok: false, error: event.message }));
        continue;
      }

      try {
        await recordToolActivity({ context: input.context, callId: call.id, toolName: call.function.name, status: "started" });
        let rawInput: unknown;
        try {
          rawInput = JSON.parse(call.function.arguments);
        } catch {
          await recordToolActivity({ context: input.context, callId: call.id, toolName: call.function.name, status: "failed", durationMs: Date.now() - start });
          outputs.push(serialise({ ok: false, error: "Tool input must be valid JSON." }));
          const event: ToolExecutionEvent = { type: "tool_failed", name: call.function.name, callId: call.id, elapsedMs: Date.now() - start, message: "Invalid JSON input." };
          events.push(event);
          await input.onEvent?.(event);
          continue;
        }
        const parsed = tool.schema.safeParse(rawInput);
        if (!parsed.success) {
          await recordToolActivity({ context: input.context, callId: call.id, toolName: call.function.name, status: "failed", toolInput: rawInput, durationMs: Date.now() - start });
          outputs.push(serialise({ ok: false, error: "Tool input did not match its schema." }));
          const event: ToolExecutionEvent = { type: "tool_failed", name: call.function.name, callId: call.id, elapsedMs: Date.now() - start, message: "Input validation failed." };
          events.push(event);
          await input.onEvent?.(event);
          continue;
        }
        const rawResult = await tool.execute(parsed.data, input.context);
        const validatedResult = tool.outputSchema.safeParse(rawResult);
        if (!validatedResult.success) {
          console.error("Agent tool output failed schema validation", { toolName: tool.name, issues: validatedResult.error.issues.length });
          throw new Error("Tool output did not match its expected schema.");
        }
        const result = validatedResult.data;
        await recordToolActivity({ context: input.context, callId: call.id, toolName: call.function.name, status: "completed", toolInput: parsed.data, toolOutput: result, durationMs: Date.now() - start });
        toolResults.push({ name: call.function.name, data: result });
        outputs.push(serialise({ ok: true, data: result }));
        const event: ToolExecutionEvent = { type: "tool_completed", name: call.function.name, callId: call.id, elapsedMs: Date.now() - start };
        events.push(event);
        await input.onEvent?.(event);
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 300) : "Tool execution failed.";
        try {
          await recordToolActivity({ context: input.context, callId: call.id, toolName: call.function.name, status: "failed", durationMs: Date.now() - start });
        } catch {
          // The database logger reports failures without revealing query details.
        }
        outputs.push(serialise({ ok: false, error: message }));
        const event: ToolExecutionEvent = { type: "tool_failed", name: call.function.name, callId: call.id, elapsedMs: Date.now() - start, message };
        events.push(event);
        await input.onEvent?.(event);
      }
    }
    reply.toolCalls.forEach((call, index) => messages.push({ role: "tool", tool_call_id: call.id, name: call.function.name, content: outputs[index] }));
  }

  const final = await input.provider.complete({ messages, tools: [] }, input.signal);
  if (final.usage) {
    usage.promptTokens += final.usage.promptTokens;
    usage.completionTokens += final.usage.completionTokens;
    usage.totalTokens += final.usage.totalTokens;
  }
  return {
    answer: final.content?.trim() || "I’ve reached the analysis step limit. Please narrow the request and try again.",
    events,
    toolResults,
    iterations: maxIterations,
    usage,
    stoppedAtLimit: true,
  };
}
