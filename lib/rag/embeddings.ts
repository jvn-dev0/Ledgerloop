import "server-only";
import { FeatureExtractionPipeline, env, pipeline } from "@huggingface/transformers";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const EMBEDDING_MODEL_ID = "Supabase/gte-small";
export const EMBEDDING_DIMENSIONS = 384;
const EMBEDDING_BATCH_SIZE = 8;

env.cacheDir = process.env.TRANSFORMERS_CACHE_DIR?.trim() || join(tmpdir(), "ledgerloop-transformers");

let extractorPromise: Promise<FeatureExtractionPipeline> | undefined;

function getExtractor() {
  extractorPromise ??= pipeline("feature-extraction", EMBEDDING_MODEL_ID, { dtype: "fp32" });
  return extractorPromise;
}

export function assertEmbeddingDimensions(value: unknown): number[] {
  if (!Array.isArray(value) || value.length !== EMBEDDING_DIMENSIONS || !value.every((component) => typeof component === "number" && Number.isFinite(component))) {
    throw new Error(`The embedding model must return ${EMBEDDING_DIMENSIONS} finite values.`);
  }
  return value as number[];
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.some((text) => !text.trim())) throw new Error("Embeddings require non-empty text.");
  const extractor = await getExtractor();
  const embeddings: number[][] = [];
  for (let start = 0; start < texts.length; start += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(start, start + EMBEDDING_BATCH_SIZE);
    const tensor = await extractor(batch, { pooling: "mean", normalize: true });
    const rows = tensor.tolist();
    if (!Array.isArray(rows) || rows.length !== batch.length) throw new Error("The embedding model returned an invalid batch.");
    for (const row of rows) embeddings.push(assertEmbeddingDimensions(row));
  }
  return embeddings;
}
