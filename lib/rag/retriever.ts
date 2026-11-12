import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.ts";
import { assertEmbeddingDimensions, embedTexts } from "./embeddings.ts";

export type PolicyPassage = {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  content: string;
  similarity: number;
};

export async function retrievePolicy(input: {
  supabase: SupabaseClient<Database>;
  businessId: string;
  query: string;
  count?: number;
  embedder?: (texts: string[]) => Promise<number[][]>;
}) {
  const query = input.query.trim().slice(0, 1000);
  if (!query) return [] as PolicyPassage[];
  const [embedding] = await (input.embedder ?? embedTexts)([query]);
  assertEmbeddingDimensions(embedding);
  const { data, error } = await input.supabase.rpc("match_knowledge_chunks", {
    p_business_id: input.businessId,
    p_embedding: JSON.stringify(embedding),
    p_match_count: Math.max(1, Math.min(input.count ?? 5, 8)),
    p_similarity_threshold: 0.25,
  });
  if (error) {
    console.error("Business policy retrieval failed", { code: error.code });
    throw new Error("Business policy search is unavailable. Check the Day 3 database migration and try again.");
  }
  return (data ?? []).map((passage) => ({
    documentId: passage.document_id,
    documentName: passage.document_name,
    chunkIndex: passage.chunk_index,
    content: passage.content.slice(0, 1200),
    similarity: passage.similarity,
  }));
}
