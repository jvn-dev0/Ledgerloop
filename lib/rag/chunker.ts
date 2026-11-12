export const MAX_CHUNK_CHARACTERS = 1200;
export const CHUNK_OVERLAP_CHARACTERS = 160;

export function normaliseDocumentText(value: string) {
  return value
    .normalize("NFC")
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/\n[ ]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function chunkDocumentText(value: string, options: { maxCharacters?: number; overlapCharacters?: number } = {}) {
  const text = normaliseDocumentText(value);
  const maxCharacters = Math.max(200, Math.min(options.maxCharacters ?? MAX_CHUNK_CHARACTERS, 4000));
  const overlap = Math.max(0, Math.min(options.overlapCharacters ?? CHUNK_OVERLAP_CHARACTERS, Math.floor(maxCharacters / 3)));
  if (!text) return [] as string[];

  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    let end = Math.min(text.length, cursor + maxCharacters);
    if (end < text.length) {
      const minBoundary = cursor + Math.floor(maxCharacters * 0.65);
      const paragraph = text.lastIndexOf("\n\n", end);
      const sentence = text.lastIndexOf(". ", end);
      const word = text.lastIndexOf(" ", end);
      const boundary = [paragraph > minBoundary ? paragraph : -1, sentence > minBoundary ? sentence + 1 : -1, word > minBoundary ? word : -1]
        .filter((position) => position > cursor)
        .sort((a, b) => b - a)[0];
      if (boundary !== undefined) end = boundary;
    }

    const chunk = text.slice(cursor, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= text.length) break;
    const nextCursor = Math.max(cursor + 1, end - overlap);
    if (nextCursor <= cursor) throw new Error("Document chunking could not make progress.");
    cursor = nextCursor;
  }
  return chunks;
}
