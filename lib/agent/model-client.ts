import "server-only";
import type { ModelProvider, ModelReply, ModelUsage, ToolCall } from "./types.ts";

const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";
export const DEFAULT_GROQ_MODEL = "qwen/qwen3.8-27b";

export type ProviderErrorCode = "configuration" | "rate_limited" | "unavailable" | "invalid_response" | "timeout";

export class ProviderError extends Error {
  constructor(message: string, readonly code: ProviderErrorCode, readonly status?: number) {
    super(message);
    this.name = "ProviderError";
  }
}

type Fetcher = typeof fetch;

function parseToolCalls(value: unknown): ToolCall[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 3) throw new ProviderError("The model returned invalid tool calls.", "invalid_response");
  const calls = value.map((item): ToolCall => {
    if (!item || typeof item !== "object") throw new ProviderError("The model returned an invalid tool call.", "invalid_response");
    const call = item as { id?: unknown; type?: unknown; function?: { name?: unknown; arguments?: unknown } };
    if (call.type !== "function" || typeof call.id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(call.id) ||
      typeof call.function?.name !== "string" || !/^[a-z][a-z0-9_]{1,63}$/.test(call.function.name) ||
      typeof call.function.arguments !== "string" || call.function.arguments.length > 12_000) {
      throw new ProviderError("The model returned an invalid tool call.", "invalid_response");
    }
    return { id: call.id, type: "function", function: { name: call.function.name, arguments: call.function.arguments } };
  });
  if (new Set(calls.map((call) => call.id)).size !== calls.length) throw new ProviderError("The model returned duplicate tool-call IDs.", "invalid_response");
  return calls;
}

function parseUsage(value: unknown): ModelUsage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const usage = value as { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown };
  if (![usage.prompt_tokens, usage.completion_tokens, usage.total_tokens].every((token) => typeof token === "number" && Number.isFinite(token) && token >= 0)) return undefined;
  return { promptTokens: usage.prompt_tokens as number, completionTokens: usage.completion_tokens as number, totalTokens: usage.total_tokens as number };
}

function parseMessage(value: unknown): ModelReply {
  if (!value || typeof value !== "object") throw new ProviderError("Groq returned an invalid response.", "invalid_response");
  const payload = value as { choices?: Array<{ message?: { content?: unknown; tool_calls?: unknown } }>; usage?: unknown };
  const message = payload.choices?.[0]?.message;
  if (!message || (message.content !== null && message.content !== undefined && typeof message.content !== "string")) {
    throw new ProviderError("Groq returned an invalid response.", "invalid_response");
  }
  return {
    content: typeof message.content === "string" ? message.content.slice(0, 12_000) : null,
    toolCalls: parseToolCalls(message.tool_calls),
    usage: parseUsage(payload.usage),
  };
}

export function createGroqModelProvider(options: { fetcher?: Fetcher; timeoutMs?: number } = {}): ModelProvider {
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 20_000;
  const modelId = process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;

  return {
    modelId,
    async complete(request, externalSignal) {
      const apiKey = process.env.GROQ_API_KEY?.trim();
      if (!apiKey) throw new ProviderError("Groq is not configured. Add GROQ_API_KEY to .env.local.", "configuration");
      const timeout = AbortSignal.timeout(timeoutMs);
      const signal = externalSignal ? AbortSignal.any([timeout, externalSignal]) : timeout;

      let response: Response;
      try {
        response = await fetcher(GROQ_CHAT_COMPLETIONS_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: modelId,
            messages: request.messages,
            tools: request.tools,
            tool_choice: "auto",
            temperature: 0.2,
            max_tokens: request.maxTokens ?? 1200,
            reasoning_effort: "low",
            reasoning_format: "hidden",
          }),
          cache: "no-store",
          signal,
        });
      } catch (error) {
        if (error instanceof Error && error.name === "TimeoutError") throw new ProviderError("Groq did not respond before the request timed out.", "timeout");
        throw new ProviderError("Groq is temporarily unavailable. Try again shortly.", "unavailable");
      }

      if (!response.ok) {
        if (response.status === 429) throw new ProviderError("Groq rate limit reached. Wait a moment and try again.", "rate_limited", 429);
        if (response.status >= 500) throw new ProviderError("Groq is temporarily unavailable. Try again shortly.", "unavailable", response.status);
        throw new ProviderError("Groq rejected the request. Check the configured model and provider settings.", "invalid_response", response.status);
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new ProviderError("Groq returned an invalid response body.", "invalid_response", response.status);
      }
      return parseMessage(payload);
    },
  };
}
