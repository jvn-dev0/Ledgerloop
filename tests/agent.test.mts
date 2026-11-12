import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { prioritizeCollections, calculateReceivableTotals, daysBetween } from "../lib/agent/collections.ts";
import { createGroqModelProvider, ProviderError } from "../lib/agent/model-client.ts";
import { runAgent } from "../lib/agent/orchestrator.ts";
import { getToolDefinitions } from "../lib/agent/tools.ts";
import { parseCustomer } from "../lib/validations/forms.ts";
import type { ModelProvider, ToolContext, ToolDefinition } from "../lib/agent/types.ts";

test("days overdue uses calendar dates and rejects invalid dates", () => {
  assert.equal(daysBetween("2026-11-01", "2026-11-11"), 10);
  assert.equal(daysBetween("2026-02-30", "2026-03-01"), null);
  assert.equal(daysBetween("2026-11-12", "2026-11-11"), -1);
});

test("receivables are summed exactly and never mixed across currencies", () => {
  assert.deepEqual(calculateReceivableTotals([
    { amount: "0.10", currency: "USD", status: "pending" },
    { amount: "0.20", currency: "USD", status: "pending" },
    { amount: "7", currency: "JPY", status: "pending" },
    { amount: "500", currency: "USD", status: "paid" },
  ]), [
    { currency: "JPY", outstanding: "7" },
    { currency: "USD", outstanding: "0.3" },
  ]);
});

test("collection prioritisation is deterministic and explains its factors", () => {
  const ranked = prioritizeCollections([
    { id: "b", invoiceNumber: "INV-2", customerId: "c1", customerName: "A", amount: "10000.00", currency: "USD", issueDate: "2026-09-01", dueDate: "2026-10-20", previousInvoiceCount: 1, previousPaidInvoiceCount: 1, reminderDraftCount: 0 },
    { id: "a", invoiceNumber: "INV-1", customerId: "c2", customerName: "B", amount: "100.00", currency: "USD", issueDate: "2026-10-20", dueDate: "2026-11-01", previousInvoiceCount: 0, previousPaidInvoiceCount: 0, reminderDraftCount: 2 },
    { id: "future", invoiceNumber: "INV-3", customerId: "c3", customerName: "C", amount: "900.00", currency: "USD", issueDate: "2026-11-01", dueDate: "2026-11-12", previousInvoiceCount: 0, previousPaidInvoiceCount: 0, reminderDraftCount: 0 },
  ], "2026-11-11");
  assert.deepEqual(ranked.map((invoice) => invoice.id), ["b", "a"]);
  assert.equal(ranked[0].daysOverdue, 22);
  assert.ok(ranked[0].reasons.includes("22 days overdue"));
  assert.ok(ranked[0].reasons.some((reason) => reason.includes("pending of 1")));
  assert.equal(ranked[1].reminderDraftCount, 2);
});

test("prioritisation raises follow-up weight for customers with more unpaid history", () => {
  const base = { invoiceNumber: "INV-1", customerName: "Customer", amount: "100", currency: "USD", issueDate: "2026-10-01", dueDate: "2026-11-01", reminderDraftCount: 0 };
  const ranked = prioritizeCollections([
    { ...base, id: "mostly-unpaid", customerId: "c1", previousInvoiceCount: 4, previousPaidInvoiceCount: 1 },
    { ...base, id: "always-paid", customerId: "c2", previousInvoiceCount: 4, previousPaidInvoiceCount: 4 },
  ], "2026-11-11");
  assert.equal(ranked[0].id, "mostly-unpaid");
  assert.ok(ranked[0].reasons.some((reason) => reason.includes("3 pending of 4")));
});

test("customer collection contact preference accepts only supported channels", () => {
  const base = new FormData();
  base.set("name", "A Customer");
  base.set("email", "ar@example.test");
  base.set("collection_contact_preference", "phone");
  assert.equal(parseCustomer(base).ok, true);
  base.set("collection_contact_preference", "sms");
  assert.equal(parseCustomer(base).ok, false);
});

test("registry exposes every required tool with a typed output schema", () => {
  const tools = getToolDefinitions();
  assert.deepEqual(tools.map((tool) => tool.name), [
    "get_business_summary", "list_invoices", "get_overdue_invoices", "get_customer_history",
    "calculate_receivables", "retrieve_business_policy", "prioritize_collections",
    "draft_payment_reminder", "create_approval_request", "get_paypal_payment_status",
  ]);
  assert.ok(tools.every((tool) => tool.outputSchema));
});

test("invoice tools bind the business scope to the authenticated server context", async () => {
  const filters: Array<[string, unknown]> = [];
  let selectedTable = "";
  const query = {
    select() { return this; },
    eq(field: string, value: unknown) { filters.push([field, value]); return this; },
    order() { return this; },
    limit() { return this; },
    then(resolve: (value: { data: never[]; error: null }) => unknown) { return Promise.resolve({ data: [] as never[], error: null }).then(resolve); },
  };
  const fakeSupabase = { from(table: string) { selectedTable = table; return query; } };
  const tool = getToolDefinitions().find((item) => item.name === "list_invoices");
  assert.ok(tool);
  const maliciousInput = { business_id: "business-other", status: "pending" };
  assert.equal(tool.schema.safeParse(maliciousInput).success, false);
  const parsed = tool.schema.parse({ status: "pending", limit: 5 });
  await tool.execute(parsed, { ...context(), supabase: fakeSupabase as unknown as ToolContext["supabase"], businessId: "business-owner" });
  assert.equal(selectedTable, "invoices");
  assert.ok(filters.some(([key, value]) => key === "business_id" && value === "business-owner"));
  assert.ok(filters.some(([key, value]) => key === "status" && value === "pending"));
  assert.ok(!filters.some(([, value]) => value === "business-other"));
});

function context() {
  return {
    supabase: { rpc: async () => ({ error: null }) },
    businessId: "00000000-0000-4000-8000-000000000001",
    businessName: "Test business",
    businessCurrency: "USD",
    ownerId: "00000000-0000-4000-8000-000000000002",
    conversationId: "00000000-0000-4000-8000-000000000003",
    today: "2026-11-11",
  } as unknown as ToolContext;
}

function provider(replies: Awaited<ReturnType<ModelProvider["complete"]>>[]): ModelProvider {
  let index = 0;
  return {
    modelId: "test/provider",
    async complete() {
      const reply = replies[index];
      if (!reply) throw new Error("No test response configured.");
      index += 1;
      return reply;
    },
  };
}

const mathSchema = z.object({ a: z.number(), b: z.number() }).strict();
const sumTool: ToolDefinition<typeof mathSchema> = {
  name: "get_sum",
  description: "Add two values.",
  parameters: { type: "object", properties: { a: { type: "number" }, b: { type: "number" } }, required: ["a", "b"], additionalProperties: false },
  schema: mathSchema,
  outputSchema: z.object({ total: z.number() }).strict(),
  async execute(input) { return { total: input.a + input.b }; },
};
const productTool: ToolDefinition<typeof mathSchema> = {
  ...sumTool,
  name: "get_product",
  description: "Multiply two values.",
  async execute(input) { return { total: input.a * input.b }; },
};

test("agent executes multiple validated tool calls then returns a grounded final answer", async () => {
  const result = await runAgent({
    message: "Calculate the total and product.",
    provider: provider([
      { content: null, toolCalls: [
        { id: "call_sum", type: "function", function: { name: "get_sum", arguments: JSON.stringify({ a: 2, b: 3 }) } },
        { id: "call_product", type: "function", function: { name: "get_product", arguments: JSON.stringify({ a: 2, b: 3 }) } },
      ], usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } },
      { content: "The total is 5 and the product is 6.", toolCalls: [], usage: { promptTokens: 20, completionTokens: 7, totalTokens: 27 } },
    ]),
    tools: [sumTool, productTool],
    context: context(),
  });
  assert.equal(result.answer, "The total is 5 and the product is 6.");
  assert.equal(result.iterations, 2);
  assert.equal(result.events.filter((event) => event.type === "tool_completed").length, 2);
  assert.deepEqual(result.toolResults.map((item) => item.data), [{ total: 5 }, { total: 6 }]);
  assert.equal(result.usage.totalTokens, 42);
});

test("agent rejects invalid arguments and does not execute the tool", async () => {
  let executed = false;
  const tool: ToolDefinition<typeof mathSchema> = { ...sumTool, async execute() { executed = true; return { total: 0 }; } };
  const result = await runAgent({
    message: "Add these values.",
    provider: provider([
      { content: null, toolCalls: [{ id: "call_bad", type: "function", function: { name: "get_sum", arguments: JSON.stringify({ a: 2, b: 3, extra: true }) } }] },
      { content: "I could not validate that request.", toolCalls: [] },
    ]),
    tools: [tool],
    context: context(),
  });
  assert.equal(executed, false);
  assert.equal(result.events[1].type, "tool_failed");
});

test("agent withholds a tool result that fails its typed output schema", async () => {
  const invalidOutput: ToolDefinition<typeof mathSchema> = { ...sumTool, async execute() { return { total: "not a number" } as unknown as { total: number }; } };
  const originalError = console.error;
  let loggedValidationFailure = false;
  console.error = (message?: unknown) => { loggedValidationFailure ||= message === "Agent tool output failed schema validation"; };
  let result: Awaited<ReturnType<typeof runAgent>> | undefined;
  try {
    result = await runAgent({
      message: "Add these values.",
      provider: provider([
        { content: null, toolCalls: [{ id: "call_output", type: "function", function: { name: "get_sum", arguments: JSON.stringify({ a: 1, b: 2 }) } }] },
        { content: "I could not verify the tool result.", toolCalls: [] },
      ]),
      tools: [invalidOutput],
      context: context(),
    });
  } finally {
    console.error = originalError;
  }
  assert.ok(result);
  assert.equal(result.toolResults.length, 0);
  assert.equal(result.events.at(-1)?.type, "tool_failed");
  assert.equal(loggedValidationFailure, true);
});

test("agent handles tool exceptions and stops after the configured iteration limit", async () => {
  const failingTool: ToolDefinition<typeof mathSchema> = { ...sumTool, async execute() { throw new Error("database unavailable"); } };
  const model = provider([
    { content: null, toolCalls: [{ id: "call_fail", type: "function", function: { name: "get_sum", arguments: JSON.stringify({ a: 1, b: 1 }) } }] },
    { content: "The tool failed safely.", toolCalls: [] },
  ]);
  const result = await runAgent({ message: "Sum these.", provider: model, tools: [failingTool], context: context(), maxIterations: 1 });
  assert.equal(result.events[1].type, "tool_failed");
  assert.equal(result.stoppedAtLimit, true);
  assert.equal(result.answer, "The tool failed safely.");
});

async function withGroqTestKey<T>(run: () => Promise<T>) {
  const previous = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = "test-only-key";
  try { return await run(); }
  finally { if (previous === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = previous; }
}

test("Groq provider parses a tool call and token usage", async () => {
  await withGroqTestKey(async () => {
    const provider = createGroqModelProvider({ fetcher: async () => Response.json({
      choices: [{ message: { content: null, tool_calls: [{ id: "call_123", type: "function", function: { name: "get_sum", arguments: "{\"a\":1,\"b\":2}" } }] } }],
      usage: { prompt_tokens: 4, completion_tokens: 3, total_tokens: 7 },
    }) });
    const reply = await provider.complete({ messages: [{ role: "user", content: "Add 1 and 2" }], tools: [] });
    assert.equal(reply.toolCalls[0].function.name, "get_sum");
    assert.equal(reply.usage?.totalTokens, 7);
  });
});

test("Groq provider reports rate limits and invalid responses without provider internals", async () => {
  await withGroqTestKey(async () => {
    const rateLimited = createGroqModelProvider({ fetcher: async () => new Response("{}", { status: 429 }) });
    await assert.rejects(rateLimited.complete({ messages: [{ role: "user", content: "Hi" }], tools: [] }), (error: unknown) => error instanceof ProviderError && error.code === "rate_limited");

    const invalid = createGroqModelProvider({ fetcher: async () => Response.json({ choices: [] }) });
    await assert.rejects(invalid.complete({ messages: [{ role: "user", content: "Hi" }], tools: [] }), (error: unknown) => error instanceof ProviderError && error.code === "invalid_response");
  });
});

test("Groq provider reports unavailable upstream and timeout states", async () => {
  await withGroqTestKey(async () => {
    const unavailable = createGroqModelProvider({ fetcher: async () => { throw new Error("network details are hidden"); } });
    await assert.rejects(unavailable.complete({ messages: [{ role: "user", content: "Hi" }], tools: [] }), (error: unknown) => error instanceof ProviderError && error.code === "unavailable");

    const timeout = createGroqModelProvider({ fetcher: async () => { const error = new Error("timeout"); error.name = "TimeoutError"; throw error; } });
    await assert.rejects(timeout.complete({ messages: [{ role: "user", content: "Hi" }], tools: [] }), (error: unknown) => error instanceof ProviderError && error.code === "timeout");
  });
});
