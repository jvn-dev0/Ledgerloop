import { z } from "zod";
import { requireWorkspace } from "@/lib/data/workspace";
import { DocumentInputError, loadDocument, MAX_DOCUMENT_BYTES } from "@/lib/rag/document-loader";
import { saveKnowledgeDocument } from "@/lib/rag/ingestion";
import { readRequestBodyWithinLimit } from "@/lib/http/request-body";
import { checkApiRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  const { supabase, business } = await requireWorkspace();
  const { data, error } = await supabase.from("knowledge_documents")
    .select("id, name, mime_type, content_sha256, chunk_count, created_at, updated_at")
    .eq("business_id", business.id)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("Knowledge document list failed", { code: error.code });
    return Response.json({ error: "Apply the Day 3 database migration before managing policy documents." }, { status: 503 });
  }
  return Response.json({ documents: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, business } = await requireWorkspace();
  const limit = await checkApiRateLimit(supabase, "knowledge_upload");
  if (!limit.allowed) {
    if ("unavailable" in limit) {
      return Response.json({ error: "Request protection is unavailable. Try again shortly." }, { status: 503 });
    }
    return Response.json({ error: "Too many document uploads. Wait a moment and try again." }, {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  }

  const boundedBody = await readRequestBodyWithinLimit(request, MAX_DOCUMENT_BYTES + 128 * 1024);
  if (!boundedBody.ok) {
    return Response.json(
      { error: boundedBody.reason === "too_large" ? "Upload request exceeds the allowed size." : "The upload request could not be read." },
      { status: boundedBody.reason === "too_large" ? 413 : 400 },
    );
  }

  const contentType = request.headers.get("content-type");
  if (!contentType?.toLowerCase().startsWith("multipart/form-data;")) {
    return Response.json({ error: "Send the document as multipart form data." }, { status: 400 });
  }

  let form: FormData;
  try {
    const parserBuffer = new ArrayBuffer(boundedBody.bytes.byteLength);
    new Uint8Array(parserBuffer).set(boundedBody.bytes);
    const parserRequest = new Request(request.url, {
      method: "POST",
      headers: { "content-type": contentType },
      body: parserBuffer,
    });
    form = await parserRequest.formData();
  } catch {
    return Response.json({ error: "Send the document as multipart form data." }, { status: 400 });
  }
  const file = form.get("file");
  const documentIdValue = form.get("documentId");
  const documentId = documentIdValue === null || documentIdValue === "" ? undefined : z.string().uuid().safeParse(documentIdValue);
  if (documentId && !documentId.success) return Response.json({ error: "Document identifier is invalid." }, { status: 400 });
  if (!(file instanceof File)) return Response.json({ error: "Choose a text, Markdown, or PDF file." }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_DOCUMENT_BYTES) return Response.json({ error: "Documents must be between 1 byte and 10 MB." }, { status: 413 });

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const document = await loadDocument({ name: file.name, mimeType: file.type, bytes });
    const saved = await saveKnowledgeDocument({ supabase, businessId: business.id, documentId: documentId?.success ? documentId.data : undefined, document });
    return Response.json({ document: saved }, { status: documentId ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The document could not be processed.";
    return Response.json({ error: message }, { status: error instanceof DocumentInputError ? 400 : 503 });
  }
}
