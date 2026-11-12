import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Invoice } from "@/types/database";
import type { InvoiceSort } from "./invoice-sorting";

export const LIST_PAGE_SIZE = 25;
export const INVOICE_STATUS_FILTERS = ["pending", "overdue", "draft", "paid", "cancelled"] as const;
export const PAYMENT_STATUS_FILTERS = ["created", "pending_approval", "approved", "captured", "failed", "cancelled"] as const;

export type InvoiceStatusFilter = (typeof INVOICE_STATUS_FILTERS)[number];
export type PaymentStatusFilter = (typeof PAYMENT_STATUS_FILTERS)[number];

export function parseInvoiceStatusFilter(value?: string): InvoiceStatusFilter | undefined {
  return INVOICE_STATUS_FILTERS.find((status) => status === value);
}

export function parsePaymentStatusFilter(value?: string): PaymentStatusFilter | undefined {
  return PAYMENT_STATUS_FILTERS.find((status) => status === value);
}

export function parseListPage(value?: string) {
  if (!value || !/^[1-9]\d{0,4}$/.test(value)) return 1;
  return Number(value);
}

export async function getDashboardData(supabase: SupabaseClient<Database>, businessId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const [summaryResult, invoiceResult, activityResult, approvalResult, priorityResult] = await Promise.all([
    supabase.rpc("get_dashboard_summary_for_business", { p_business_id: businessId }),
    supabase.from("invoices").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(6),
    supabase.from("payment_attempts").select("id, invoice_id, amount, currency, status, provider, created_at").eq("business_id", businessId).order("created_at", { ascending: false }).limit(5),
    supabase.from("approval_requests").select("id, invoice_id, reason, created_at", { count: "exact" }).eq("business_id", businessId).eq("status", "pending").order("created_at", { ascending: false }).limit(5),
    supabase.from("invoices").select("id, invoice_number, customer_id, amount, currency, due_date", { count: "exact" }).eq("business_id", businessId).eq("status", "pending").lt("due_date", today).order("due_date", { ascending: true }).order("amount", { ascending: false }).limit(5),
  ]);

  if (summaryResult.error) throw new Error("Dashboard summary query failed.");
  if (invoiceResult.error) throw new Error("Recent invoice query failed.");
  if (activityResult.error) throw new Error("Recent payment activity query failed.");
  if (approvalResult.error) console.error("Dashboard approval query failed", { code: approvalResult.error.code ?? "unknown" });
  if (priorityResult.error) console.error("Dashboard overdue invoice query failed", { code: priorityResult.error.code ?? "unknown" });

  const invoices = invoiceResult.data as Invoice[];
  const relatedInvoiceIds = [...new Set([
    ...invoices.map((invoice) => invoice.id),
    ...activityResult.data.map((item) => item.invoice_id),
    ...(approvalResult.data ?? []).map((item) => item.invoice_id),
    ...(priorityResult.data ?? []).map((item) => item.id),
  ])];
  const relatedInvoiceResult = relatedInvoiceIds.length
    ? await supabase.from("invoices").select("id, invoice_number, customer_id").eq("business_id", businessId).in("id", relatedInvoiceIds)
    : { data: [], error: null };
  if (relatedInvoiceResult.error) throw new Error("Recent activity invoice lookup failed.");
  const customerIds = [...new Set((relatedInvoiceResult.data ?? []).map((invoice) => invoice.customer_id))];
  const customerResult = customerIds.length
    ? await supabase.from("customers").select("id, name, company_name").eq("business_id", businessId).in("id", customerIds)
    : { data: [], error: null };
  if (customerResult.error) throw new Error("Recent activity customer lookup failed.");

  return {
    summary: summaryResult.data,
    invoices,
    pendingApprovals: approvalResult.data ?? [],
    pendingApprovalCount: approvalResult.count ?? 0,
    pendingApprovalsError: Boolean(approvalResult.error),
    priorityInvoices: priorityResult.data ?? [],
    priorityInvoiceCount: priorityResult.count ?? 0,
    priorityInvoicesError: Boolean(priorityResult.error),
    today,
    invoiceById: new Map((relatedInvoiceResult.data ?? []).map((invoice) => [invoice.id, invoice])),
    customerById: new Map((customerResult.data ?? []).map((customer) => [customer.id, customer])),
    activity: activityResult.data,
  };
}

export async function getCustomers(supabase: SupabaseClient<Database>, businessId: string, query = "", page = 1) {
  let request = supabase.from("customers").select("*", { count: "exact" }).eq("business_id", businessId).order("name", { ascending: true });
  const needle = query.trim().replace(/[^a-zA-Z0-9@+\- ]/g, "").slice(0, 100);
  if (needle) request = request.or(`name.ilike.%${needle}%,email.ilike.%${needle}%,company_name.ilike.%${needle}%`);
  return request.range((page - 1) * LIST_PAGE_SIZE, page * LIST_PAGE_SIZE - 1);
}

export async function getInvoices(supabase: SupabaseClient<Database>, businessId: string, query = "", page = 1, status?: InvoiceStatusFilter, sort: InvoiceSort = "newest") {
  let request = supabase.from("invoices").select("*", { count: "exact" }).eq("business_id", businessId);
  const needle = query.trim().replace(/[%_]/g, "").slice(0, 100);
  if (needle) request = request.ilike("invoice_number", `%${needle}%`);
  if (status === "overdue") request = request.eq("status", "pending").lt("due_date", new Date().toISOString().slice(0, 10));
  else if (status) request = request.eq("status", status);

  if (sort === "oldest") request = request.order("created_at", { ascending: true }).order("id", { ascending: true });
  else if (sort === "due_soon") request = request.order("due_date", { ascending: true }).order("created_at", { ascending: false }).order("id", { ascending: false });
  else if (sort === "due_late") request = request.order("due_date", { ascending: false }).order("created_at", { ascending: false }).order("id", { ascending: false });
  else if (sort === "number_asc") request = request.order("invoice_number", { ascending: true }).order("id", { ascending: true });
  else if (sort === "number_desc") request = request.order("invoice_number", { ascending: false }).order("id", { ascending: false });
  else request = request.order("created_at", { ascending: false }).order("id", { ascending: false });
  return request.range((page - 1) * LIST_PAGE_SIZE, page * LIST_PAGE_SIZE - 1);
}
