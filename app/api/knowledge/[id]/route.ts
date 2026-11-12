import { z } from "zod";
import { requireWorkspace } from "@/lib/data/workspace";
import { deleteKnowledgeDocument } from "@/lib/rag/ingestion";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return Response.json({ error: "Document identifier is invalid." }, { status: 400 });
  const { supabase, business } = await requireWorkspace();
  try {
    const deleted = await deleteKnowledgeDocument({ supabase, businessId: business.id, documentId: id });
    if (!deleted) return Response.json({ error: "Document was not found in this business." }, { status: 404 });
    return Response.json({ deleted: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Document could not be deleted." }, { status: 503 });
  }
}
