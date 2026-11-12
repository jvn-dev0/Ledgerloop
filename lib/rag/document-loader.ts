import "server-only";
import { normaliseDocumentText } from "./chunker.ts";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_DOCUMENT_CHARACTERS = 250_000;
export const MAX_PDF_PAGES = 80;

export class DocumentInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentInputError";
  }
}

export type SupportedDocumentType = "text/plain" | "text/markdown" | "application/pdf";

export type LoadedDocument = {
  name: string;
  mimeType: SupportedDocumentType;
  content: string;
  sha256: string;
};

function cleanName(name: string) {
  const base = name.replace(/[\\/]/g, "_").replace(/[\u0000-\u001f]/g, " ").trim().slice(-180);
  return base || "business-policy";
}

function detectType(name: string, mimeType: string, bytes: Uint8Array): SupportedDocumentType {
  const normalMime = mimeType.split(";")[0].trim().toLowerCase();
  const extension = name.toLowerCase().split(".").pop();
  if (bytes.length >= 5 && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-") {
    if (normalMime !== "application/pdf" && extension !== "pdf") throw new DocumentInputError("The file content does not match a PDF document.");
    return "application/pdf";
  }
  if (normalMime === "application/pdf" || extension === "pdf") throw new DocumentInputError("This PDF file is invalid or could not be recognised.");
  if (normalMime === "text/markdown" || extension === "md" || extension === "markdown") return "text/markdown";
  if (normalMime === "text/plain" || extension === "txt") return "text/plain";
  throw new DocumentInputError("Upload a plain text, Markdown, or PDF file.");
}

async function extractPdfText(bytes: Uint8Array) {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const document = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: true }).promise;
    try {
      if (document.numPages > MAX_PDF_PAGES) throw new DocumentInputError(`PDFs must contain ${MAX_PDF_PAGES} pages or fewer.`);
      const pages: string[] = [];
      let characters = 0;
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const text = await page.getTextContent();
        const pageText = text.items.flatMap((item) => "str" in item && typeof item.str === "string" ? [item.str] : []).join(" ");
        characters += pageText.length;
        if (characters > MAX_DOCUMENT_CHARACTERS) throw new DocumentInputError("Extracted PDF text exceeds the 250,000-character limit.");
        pages.push(pageText);
      }
      return pages.join("\n\n");
    } finally {
      await document.destroy();
    }
  } catch (error) {
    if (error instanceof DocumentInputError) throw error;
    throw new DocumentInputError("This PDF file could not be read.");
  }
}

export async function loadDocument(input: { name: string; mimeType: string; bytes: Uint8Array }): Promise<LoadedDocument> {
  if (!(input.bytes instanceof Uint8Array) || input.bytes.byteLength === 0) throw new DocumentInputError("The uploaded document is empty.");
  if (input.bytes.byteLength > MAX_DOCUMENT_BYTES) throw new DocumentInputError("Documents must be 10 MB or smaller.");
  const name = cleanName(input.name);
  const mimeType = detectType(name, input.mimeType, input.bytes);
  let rawText: string;
  try {
    rawText = mimeType === "application/pdf"
      ? await extractPdfText(input.bytes)
      : new TextDecoder("utf-8", { fatal: true }).decode(input.bytes);
  } catch (error) {
    if (error instanceof DocumentInputError) throw error;
    throw new DocumentInputError("The uploaded text could not be decoded as UTF-8.");
  }
  const content = normaliseDocumentText(rawText);
  if (!content) throw new DocumentInputError("No readable text was found in this document.");
  if (content.length > MAX_DOCUMENT_CHARACTERS) throw new DocumentInputError("Documents must contain 250,000 extracted characters or fewer.");
  const { createHash } = await import("node:crypto");
  return { name, mimeType, content, sha256: createHash("sha256").update(content).digest("hex") };
}
