import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Invoice } from "@/types/database";

export const LIST_PAGE_SIZE = 25;

export function parseListPage(value?: string) {
  if (!value || !/^[1-9]\d{0,4}$/.test(value)) return 1;
  return Number(value);
}

export async function getDashboardData(supabase: SupabaseClient<Database>, businessId: string) {
  const [summaryResult, invoiceResult, activityResult] = await Promise.all([
    supabase.rpc("get_dashboard_summary_for_business", { p_business_id: businessId }),
    supabase.from("invoices").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(6),
    supabase.from("payment_attempts").select("id, invoice_id, amount, currency, status, provider, created_at").eq("business_id", businessId).order("created_at", { ascending: false }).limit(5),
  ]);

  if (summaryResult.error) throw new Error(`Dashboard summary query failed: ${summaryResult.error.message}`);
  if (invoiceResult.error) throw new Error(`Recent invoices query failed: ${invoiceResult.error.message}`);
  if (activityResult.error) throw new Error(`Recent payment activity query failed: ${activityResult.error.message}`);

  const invoices = invoiceResult.data as Invoice[];
  const relatedInvoiceIds = [...new Set([
    ...invoices.map((invoice) => invoice.id),
    ...activityResult.data.map((item) => item.invoice_id),
  ])];
  const relatedInvoiceResult = relatedInvoiceIds.length
    ? await supabase.from("invoices").select("id, invoice_number, customer_id").eq("business_id", businessId).in("id", relatedInvoiceIds)
    : { data: [], error: null };
  if (relatedInvoiceResult.error) throw new Error(`Recent activity invoice lookup failed: ${relatedInvoiceResult.error.message}`);
  const customerIds = [...new Set((relatedInvoiceResult.data ?? []).map((invoice) => invoice.customer_id))];
  const customerResult = customerIds.length
    ? await supabase.from("customers").select("id, name, company_name").eq("business_id", businessId).in("id", customerIds)
    : { data: [], error: null };
  if (customerResult.error) throw new Error(`Recent activity customer lookup failed: ${customerResult.error.message}`);

  return {
    summary: summaryResult.data,
    invoices,
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

export async function getInvoices(supabase: SupabaseClient<Database>, businessId: string, query = "", page = 1) {
  let request = supabase.from("invoices").select("*", { count: "exact" }).eq("business_id", businessId).order("created_at", { ascending: false });
  const needle = query.trim().replace(/[%_]/g, "").slice(0, 100);
  if (needle) request = request.ilike("invoice_number", `%${needle}%`);
  return request.range((page - 1) * LIST_PAGE_SIZE, page * LIST_PAGE_SIZE - 1);
}
