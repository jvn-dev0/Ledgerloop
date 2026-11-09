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
        { id: string; business_id: string; name: string; email: string; phone: string | null; company_name: string | null; notes: string | null; created_at: string; updated_at: string },
        { id?: string; business_id: string; name: string; email: string; phone?: string | null; company_name?: string | null; notes?: string | null; created_at?: string; updated_at?: string }
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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Business = Database["public"]["Tables"]["businesses"]["Row"];
export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type Invoice = Database["public"]["Tables"]["invoices"]["Row"];
