import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { Database } from "../../types/database.ts";

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type AgentMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; name?: string; content: string };

export type ModelTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ModelUsage = { promptTokens: number; completionTokens: number; totalTokens: number };

export type ModelReply = {
  content: string | null;
  toolCalls: ToolCall[];
  usage?: ModelUsage;
};

export type ModelRequest = {
  messages: AgentMessage[];
  tools: ModelTool[];
  maxTokens?: number;
};

export interface ModelProvider {
  readonly modelId: string;
  complete(request: ModelRequest, signal?: AbortSignal): Promise<ModelReply>;
}

export type ToolContext = {
  supabase: SupabaseClient<Database>;
  businessId: string;
  businessName: string;
  businessCurrency: string;
  ownerId: string;
  conversationId: string;
  today: string;
};

export type ToolDefinition<TInputSchema extends z.ZodType = z.ZodType, TOutputSchema extends z.ZodType = z.ZodType> = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  schema: TInputSchema;
  outputSchema: TOutputSchema;
  execute(input: z.output<TInputSchema>, context: ToolContext): Promise<z.output<TOutputSchema>>;
};

export type ToolExecutionEvent = {
  type: "tool_started" | "tool_completed" | "tool_failed";
  name: string;
  callId: string;
  elapsedMs?: number;
  message?: string;
};
