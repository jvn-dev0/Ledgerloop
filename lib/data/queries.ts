import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Invoice } from "@/types/database";

export async function getDashboardData(supabase: SupabaseClient<Database>, businessId: string) {
  const [summaryResult, invoiceResult, activityResult] = await Promise.all([
    supabase.rpc("get_dashboard_summary", {}),
    supabase.from("invoices").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(6),
    supabase.from("payment_attempts").select("id, invoice_id, amount, currency, status, provider, created_at").eq("business_id", businessId).order("created_at", { ascending: false }).limit(5),
  ]);

  if (summaryResult.error) throw new Error(`Dashboard summary query failed: ${summaryResult.error.message}`);
  if (invoiceResult.error) throw new Error(`Recent invoices query failed: ${invoiceResult.error.message}`);
  if (activityResult.error) throw new Error(`Recent payment activity query failed: ${activityResult.error.message}`);

  const invoices = invoiceResult.data as Invoice[];
  const customerIds = [...new Set(invoices.map((invoice) => invoice.customer_id))];
  const customerResult = customerIds.length
    ? await supabase.from("customers").select("id, name, company_name").eq("business_id", businessId).in("id", customerIds)
    : { data: [], error: null };
  if (customerResult.error) throw new Error(`Recent invoice customers query failed: ${customerResult.error.message}`);

  return {
    summary: summaryResult.data,
    invoices,
    customers: new Map(customerResult.data.map((customer) => [customer.id, customer])),
    activity: activityResult.data,
  };
}

export async function getCustomers(supabase: SupabaseClient<Database>, businessId: string, query = "") {
  let request = supabase.from("customers").select("*").eq("business_id", businessId).order("name", { ascending: true }).limit(500);
  const needle = query.trim().replace(/[,.()%_*\\]/g, "").slice(0, 100);
  if (needle) request = request.or(`name.ilike.%${needle}%,email.ilike.%${needle}%,company_name.ilike.%${needle}%`);
  return request;
}

export async function getInvoices(supabase: SupabaseClient<Database>, businessId: string, query = "") {
  let request = supabase.from("invoices").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(500);
  const needle = query.trim().replace(/[,.()%_*\\]/g, "").slice(0, 100);
  if (needle) request = request.ilike("invoice_number", `%${needle}%`);
  return request;
}
