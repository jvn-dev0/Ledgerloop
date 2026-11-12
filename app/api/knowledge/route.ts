import { z } from "zod";
import { requireWorkspace } from "@/lib/data/workspace";
import { DocumentInputError, loadDocument, MAX_DOCUMENT_BYTES } from "@/lib/rag/document-loader";
import { saveKnowledgeDocument } from "@/lib/rag/ingestion";

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
  let form: FormData;
  try {
    form = await request.formData();
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
