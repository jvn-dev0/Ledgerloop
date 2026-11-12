import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../types/database.ts";
import { chunkDocumentText } from "./chunker.ts";
import { assertEmbeddingDimensions, embedTexts } from "./embeddings.ts";
import { DocumentInputError, type LoadedDocument } from "./document-loader.ts";

export async function saveKnowledgeDocument(input: {
  supabase: SupabaseClient<Database>;
  businessId: string;
  documentId?: string;
  document: LoadedDocument;
  embedder?: (texts: string[]) => Promise<number[][]>;
}) {
  const chunks = chunkDocumentText(input.document.content);
  if (!chunks.length) throw new DocumentInputError("The document does not contain enough readable text to index.");
  if (chunks.length > 300) throw new DocumentInputError("This document creates more than 300 knowledge chunks. Reduce its size and try again.");

  const embeddings = await (input.embedder ?? embedTexts)(chunks);
  if (embeddings.length !== chunks.length) throw new Error("The embedding model returned an invalid batch.");
  embeddings.forEach(assertEmbeddingDimensions);
  const chunkPayload: Json = chunks.map((content, index) => ({
    content,
    embedding: JSON.stringify(embeddings[index]),
  }));
  const { data, error } = await input.supabase.rpc("save_knowledge_document", {
    p_document_id: input.documentId ?? null,
    p_business_id: input.businessId,
    p_name: input.document.name,
    p_mime_type: input.document.mimeType,
    p_content_sha256: input.document.sha256,
    p_chunks: chunkPayload,
  });
  if (error || !data) {
    console.error("Knowledge document save failed", { code: error?.code });
    throw new Error("The policy document could not be saved. Check the Day 3 database migration and try again.");
  }
  return { id: data, name: input.document.name, chunkCount: chunks.length };
}

export async function deleteKnowledgeDocument(input: { supabase: SupabaseClient<Database>; businessId: string; documentId: string }) {
  const { data, error } = await input.supabase
    .from("knowledge_documents")
    .delete()
    .eq("business_id", input.businessId)
    .eq("id", input.documentId)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Knowledge document deletion failed", error);
    throw new Error("The policy document could not be deleted.");
  }
  return Boolean(data);
}
