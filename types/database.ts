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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Business = Database["public"]["Tables"]["businesses"]["Row"];
export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type Invoice = Database["public"]["Tables"]["invoices"]["Row"];
