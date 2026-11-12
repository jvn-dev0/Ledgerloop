import assert from "node:assert/strict";
import test from "node:test";
import { loadDocument } from "../lib/rag/document-loader.ts";
import { assertEmbeddingDimensions, EMBEDDING_DIMENSIONS } from "../lib/rag/embeddings.ts";
import { chunkDocumentText } from "../lib/rag/chunker.ts";
import { saveKnowledgeDocument, deleteKnowledgeDocument } from "../lib/rag/ingestion.ts";
import { retrievePolicy } from "../lib/rag/retriever.ts";
import { buildSystemPrompt } from "../lib/agent/system-prompt.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.ts";

test("document chunker normalises text and bounds overlapping chunks", () => {
  const text = `${"Payment terms are reviewed each month.\r\n\r\n".repeat(35)}Final section.`;
  const chunks = chunkDocumentText(text, { maxCharacters: 220, overlapCharacters: 40 });
  assert.ok(chunks.length > 2);
  assert.ok(chunks.every((chunk) => chunk.length <= 220 && chunk.length > 0));
  assert.ok(chunks.join(" ").includes("Final section."));
  assert.ok(!chunks.some((chunk) => chunk.includes("\r")));
});

test("document loader accepts plain text and returns a stable content hash", async () => {
  const bytes = new TextEncoder().encode("Payment policy: contact owners before preparing a payment link.\n");
  const first = await loadDocument({ name: "policy.md", mimeType: "text/markdown", bytes });
  const second = await loadDocument({ name: "policy.md", mimeType: "text/markdown", bytes });
  assert.equal(first.content, "Payment policy: contact owners before preparing a payment link.");
  assert.equal(first.sha256, second.sha256);
  assert.equal(first.mimeType, "text/markdown");
});

test("embedding dimensions are validated and never silently substituted", () => {
  assert.equal(assertEmbeddingDimensions(Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.125)).length, EMBEDDING_DIMENSIONS);
  assert.throws(() => assertEmbeddingDimensions(Array.from({ length: EMBEDDING_DIMENSIONS - 1 }, () => 0.125)), /384 finite values/);
  const invalid = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.125);
  invalid[3] = Number.NaN;
  assert.throws(() => assertEmbeddingDimensions(invalid), /384 finite values/);
});

test("policy retrieval scopes the vector query to the requested business", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const supabase = { rpc: async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args });
    return { data: [{ chunk_id: "chunk-1", document_id: "doc-1", document_name: "Terms.md", chunk_index: 0, content: "Payment terms are net 15 days.", similarity: 0.81 }], error: null };
  } } as unknown as SupabaseClient<Database>;
  const policy = await retrievePolicy({
    supabase,
    businessId: "business-a",
    query: "payment terms",
    embedder: async (texts) => {
      assert.deepEqual(texts, ["payment terms"]);
      return [Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.1)];
    },
  });
  assert.equal(calls[0].name, "match_knowledge_chunks");
  assert.equal(calls[0].args.p_business_id, "business-a");
  assert.equal(policy[0].documentName, "Terms.md");
});

test("document update passes the existing document ID and business-scoped content to the atomic save RPC", async () => {
  let call: { name: string; args: Record<string, unknown> } | undefined;
  const supabase = { rpc: async (name: string, args: Record<string, unknown>) => {
    call = { name, args };
    return { data: "document-1", error: null };
  } } as unknown as SupabaseClient<Database>;
  const result = await saveKnowledgeDocument({
    supabase,
    businessId: "business-a",
    documentId: "document-1",
    document: { name: "Policy.md", mimeType: "text/markdown", content: "This is an actual policy document.", sha256: "a".repeat(64) },
    embedder: async (texts) => texts.map(() => Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.25)),
  });
  assert.equal(result.id, "document-1");
  assert.equal(call?.name, "save_knowledge_document");
  assert.equal(call?.args.p_document_id, "document-1");
  assert.equal(call?.args.p_business_id, "business-a");
  assert.equal((call?.args.p_chunks as Array<{ embedding: string }>)[0].embedding.startsWith("["), true);
});

test("document deletion always filters by both business and document ID", async () => {
  const filters: Array<[string, string]> = [];
  const query = {
    delete() { return this; },
    eq(field: string, value: string) { filters.push([field, value]); return this; },
    select() { return this; },
    async maybeSingle() { return { data: { id: "doc-a" }, error: null }; },
  };
  const supabase = { from: (table: string) => { assert.equal(table, "knowledge_documents"); return query; } } as unknown as SupabaseClient<Database>;
  assert.equal(await deleteKnowledgeDocument({ supabase, businessId: "business-a", documentId: "doc-a" }), true);
  assert.deepEqual(filters, [["business_id", "business-a"], ["id", "doc-a"]]);
});

test("system prompt marks policy passages as untrusted and disallows secret or action instructions", () => {
  const prompt = buildSystemPrompt({ businessName: "A business", currency: "USD", today: "2026-11-11" });
  assert.match(prompt, /untrusted reference text/i);
  assert.match(prompt, /Sensitive actions always require an explicit owner approval/);
  assert.match(prompt, /Never invent or recalculate authoritative financial data/);
});
