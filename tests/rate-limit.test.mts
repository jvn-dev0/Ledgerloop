import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkApiRateLimit } from "../lib/security/rate-limit.js";
import type { Database } from "../types/database.js";

function clientWith(data: unknown, error: unknown = null) {
  return {
    rpc: async (name: string, args: { p_scope: string }) => {
      assert.equal(name, "consume_api_rate_limit");
      assert.equal(args.p_scope, "agent_chat");
      return { data, error };
    },
  } as unknown as SupabaseClient<Database>;
}

test("rate limit allows a request below the persisted limit", async () => {
  assert.deepEqual(
    await checkApiRateLimit(clientWith([{ allowed: true, retry_after_seconds: 60 }]), "agent_chat"),
    { allowed: true },
  );
});

test("rate limit returns a bounded retry delay when the limit is exceeded", async () => {
  assert.deepEqual(
    await checkApiRateLimit(clientWith([{ allowed: false, retry_after_seconds: 12.2 }]), "agent_chat"),
    { allowed: false, retryAfterSeconds: 13 },
  );
});

test("rate limit fails closed when the RPC is unavailable", async () => {
  const original = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(
      await checkApiRateLimit(clientWith(null, { code: "PGRST202" }), "agent_chat"),
      { allowed: false, unavailable: true },
    );
  } finally {
    console.error = original;
  }
});

test("rate limit fails closed on malformed RPC data", async () => {
  const original = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(
      await checkApiRateLimit(clientWith([{ allowed: "yes", retry_after_seconds: null }]), "agent_chat"),
      { allowed: false, unavailable: true },
    );
  } finally {
    console.error = original;
  }
});
