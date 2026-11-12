export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      businesses: Table<
        { id: string; name: string; owner_id: string; default_currency: string; created_at: string; updated_at: string },
        { id?: string; name: string; owner_id: string; default_currency?: string; created_at?: string; updated_at?: string }
      >;
      customers: Table<
        { id: string; business_id: string; name: string; email: string; phone: string | null; company_name: string | null; notes: string | null; collection_contact_preference: "email" | "phone" | "portal" | null; created_at: string; updated_at: string },
        { id?: string; business_id: string; name: string; email: string; phone?: string | null; company_name?: string | null; notes?: string | null; collection_contact_preference?: "email" | "phone" | "portal" | null; created_at?: string; updated_at?: string }
      >;
      invoices: Table<
        { id: string; business_id: string; customer_id: string; invoice_number: string; description: string; amount: string; currency: string; issue_date: string; due_date: string; status: "draft" | "pending" | "paid" | "cancelled"; created_at: string; updated_at: string },
        { id?: string; business_id: string; customer_id: string; invoice_number: string; description: string; amount: string; currency: string; issue_date: string; due_date: string; status?: "draft" | "pending" | "paid" | "cancelled"; created_at?: string; updated_at?: string }
      >;
      payment_attempts: Table<
        { id: string; business_id: string; invoice_id: string; provider: "paypal"; provider_order_id: string | null; provider_capture_id: string | null; amount: string; currency: string; status: "created" | "pending_approval" | "approved" | "captured" | "failed" | "cancelled"; idempotency_key: string; created_at: string; updated_at: string },
        { id?: string; business_id: string; invoice_id: string; provider: "paypal"; provider_order_id?: string | null; provider_capture_id?: string | null; amount: string; currency: string; status: "created" | "pending_approval" | "approved" | "captured" | "failed" | "cancelled"; idempotency_key: string; created_at?: string; updated_at?: string }
      >;
      invoice_payment_links: Table<
        { id: string; business_id: string; invoice_id: string; token_hash: string; created_by: string | null; created_at: string; revoked_at: string | null },
        { id?: string; business_id: string; invoice_id: string; token_hash: string; created_by?: string | null; created_at?: string; revoked_at?: string | null }
      >;
      paypal_webhook_events: Table<
        { event_id: string; event_type: string; resource_id: string | null; status: "processing" | "processed" | "ignored" | "failed"; result_detail: string | null; received_at: string; processed_at: string | null },
        { event_id: string; event_type: string; resource_id?: string | null; status: "processing" | "processed" | "ignored" | "failed"; result_detail?: string | null; received_at?: string; processed_at?: string | null }
      >;
      knowledge_documents: Table<
        { id: string; business_id: string; name: string; mime_type: "text/plain" | "text/markdown" | "application/pdf"; content_sha256: string; chunk_count: number; created_by: string; created_at: string; updated_at: string },
        { id?: string; business_id: string; name: string; mime_type: "text/plain" | "text/markdown" | "application/pdf"; content_sha256: string; chunk_count?: number; created_by: string; created_at?: string; updated_at?: string }
      >;
      knowledge_chunks: Table<
        { id: string; business_id: string; document_id: string; chunk_index: number; content: string; embedding: string; created_at: string },
        { id?: string; business_id: string; document_id: string; chunk_index: number; content: string; embedding: string; created_at?: string }
      >;
      agent_conversations: Table<
        { id: string; business_id: string; created_by: string; title: string; created_at: string; updated_at: string },
        { id?: string; business_id: string; created_by: string; title?: string; created_at?: string; updated_at?: string }
      >;
      agent_messages: Table<
        { id: string; business_id: string; conversation_id: string; role: "user" | "assistant"; content: string; metadata: Json; created_at: string },
        { id?: string; business_id: string; conversation_id: string; role: "user" | "assistant"; content: string; metadata?: Json; created_at?: string }
      >;
      agent_activity: Table<
        { id: string; business_id: string; conversation_id: string; actor_id: string; tool_call_id: string; tool_name: string; status: "started" | "completed" | "failed"; entity_type: string | null; entity_id: string | null; input_summary: Json; output_summary: Json; duration_ms: number | null; created_at: string; updated_at: string },
        { id?: string; business_id: string; conversation_id: string; actor_id: string; tool_call_id: string; tool_name: string; status: "started" | "completed" | "failed"; entity_type?: string | null; entity_id?: string | null; input_summary?: Json; output_summary?: Json; duration_ms?: number | null; created_at?: string; updated_at?: string }
      >;
      approval_requests: Table<
        { id: string; business_id: string; conversation_id: string; invoice_id: string; action_type: "create_payment_link"; status: "pending" | "executing" | "approved" | "rejected" | "executed" | "failed" | "expired"; requested_by: string; decided_by: string | null; reason: string; result: Json; created_at: string; decided_at: string | null; expires_at: string },
        { id?: string; business_id: string; conversation_id: string; invoice_id: string; action_type: "create_payment_link"; status?: "pending" | "executing" | "approved" | "rejected" | "executed" | "failed" | "expired"; requested_by: string; decided_by?: string | null; reason: string; result?: Json; created_at?: string; decided_at?: string | null; expires_at?: string }
      >;
      audit_logs: Table<
        { id: string; business_id: string; actor_type: "user" | "system"; actor_id: string | null; action: string; entity_type: string; entity_id: string | null; metadata: Json; created_at: string },
        { id?: string; business_id: string; actor_type: "user" | "system"; actor_id?: string | null; action: string; entity_type: string; entity_id?: string | null; metadata?: Json; created_at?: string }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      get_dashboard_summary: {
        Args: Record<string, never>;
        Returns: { currency: string; total_invoiced: string; total_paid: string; total_outstanding: string; total_overdue: string; invoice_count: number; overdue_count: number }[];
      };
      get_dashboard_summary_for_business: {
        Args: { p_business_id: string };
        Returns: { currency: string; total_invoiced: string; total_paid: string; total_outstanding: string; total_overdue: string; invoice_count: number; overdue_count: number; draft_count: number; pending_count: number; paid_count: number; cancelled_count: number }[];
      };
      finalize_paypal_payment: {
        Args: { p_attempt_id: string; p_order_id: string; p_capture_id: string; p_amount: string; p_currency: string };
        Returns: boolean;
      };
      match_knowledge_chunks: {
        Args: { p_business_id: string; p_embedding: string; p_match_count?: number; p_similarity_threshold?: number };
        Returns: { chunk_id: string; document_id: string; document_name: string; chunk_index: number; content: string; similarity: number }[];
      };
      save_knowledge_document: {
        Args: { p_document_id: string | null; p_business_id: string; p_name: string; p_mime_type: string; p_content_sha256: string; p_chunks: Json };
        Returns: string;
      };
      get_customer_payment_history: {
        Args: { p_business_id: string; p_customer_ids: string[]; p_exclude_invoice_ids?: string[] };
        Returns: { customer_id: string; previous_invoice_count: number; previous_paid_invoice_count: number }[];
      };
      get_invoice_reminder_counts: {
        Args: { p_business_id: string; p_invoice_ids: string[] };
        Returns: { invoice_id: string; reminder_draft_count: number }[];
      };
      record_agent_activity: {
        Args: { p_business_id: string; p_conversation_id: string; p_tool_call_id: string; p_tool_name: string; p_status: "started" | "completed" | "failed"; p_entity_type: string | null; p_entity_id: string | null; p_input_summary: Json; p_output_summary: Json; p_duration_ms: number };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Business = Database["public"]["Tables"]["businesses"]["Row"];
export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type Invoice = Database["public"]["Tables"]["invoices"]["Row"];
