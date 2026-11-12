import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.js";

export type ApiRateLimitScope = "agent_chat" | "knowledge_upload";

export type ApiRateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number }
  | { allowed: false; unavailable: true };

export async function checkApiRateLimit(
  supabase: SupabaseClient<Database>,
  scope: ApiRateLimitScope,
): Promise<ApiRateLimitDecision> {
  const { data, error } = await supabase.rpc("consume_api_rate_limit", { p_scope: scope });
  if (error) {
    console.error("API rate limit check failed", { code: error.code ?? "unknown", scope });
    return { allowed: false, unavailable: true };
  }

  const result = data?.[0];
  if (!result || typeof result.allowed !== "boolean" || !Number.isFinite(result.retry_after_seconds)) {
    console.error("API rate limit response was invalid", { scope });
    return { allowed: false, unavailable: true };
  }

  if (result.allowed) return { allowed: true };
  return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(result.retry_after_seconds)) };
}
