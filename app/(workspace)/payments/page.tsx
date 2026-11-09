import Link from "next/link";
import { requireWorkspace } from "@/lib/data/workspace";
import { formatMoney } from "@/lib/finance/money";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";

export default async function PaymentsPage() {
  const { supabase, business } = await requireWorkspace();
  const attemptsResult = await supabase.from("payment_attempts").select("*").eq("business_id", business.id).order("created_at", { ascending: false }).limit(500);
  let invoiceById = new Map<string, { invoice_number: string; customer_id: string }>();
  let customerById = new Map<string, { name: string }>();
  let relatedError = false;
  if (attemptsResult.data?.length) {
    const invoiceIds = [...new Set(attemptsResult.data.map((attempt) => attempt.invoice_id))];
    const invoices = await supabase.from("invoices").select("id, invoice_number, customer_id").eq("business_id", business.id).in("id", invoiceIds);
    relatedError ||= Boolean(invoices.error);
    invoiceById = new Map((invoices.data ?? []).map((invoice) => [invoice.id, invoice]));
    const customerIds = [...new Set((invoices.data ?? []).map((invoice) => invoice.customer_id))];
    if (customerIds.length) {
      const customers = await supabase.from("customers").select("id, name").eq("business_id", business.id).in("id", customerIds);
      relatedError ||= Boolean(customers.error);
      customerById = new Map((customers.data ?? []).map((customer) => [customer.id, customer]));
    }
  }

  return (
    <main className="main-content">
      <PageHeading eyebrow="Transactions" title="Payments" subtitle="Track payment attempts and their verified references against invoices." />
      {attemptsResult.error || relatedError ? <div className="alert" role="alert">Payment records could not be loaded. Refresh and try again.</div> : attemptsResult.data?.length ? <section className="card"><div className="table-wrap"><table className="data-table"><thead><tr><th>Invoice</th><th>Customer</th><th>Provider</th><th>Order / capture</th><th>Status</th><th className="amount-cell">Amount</th><th>Created</th></tr></thead><tbody>{attemptsResult.data.map((attempt) => { const invoice = invoiceById.get(attempt.invoice_id); return <tr key={attempt.id}><td className="primary-cell">{invoice ? <Link href={`/invoices/${attempt.invoice_id}`}>{invoice.invoice_number}</Link> : "Invoice unavailable"}</td><td>{invoice ? customerById.get(invoice.customer_id)?.name ?? "Customer unavailable" : "—"}</td><td>{attempt.provider.toUpperCase()}</td><td>{attempt.provider_capture_id ?? attempt.provider_order_id ?? "—"}</td><td><StatusBadge status={attempt.status.replaceAll("_", " ")} /></td><td className="amount-cell">{formatMoney(attempt.amount, attempt.currency)}</td><td>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(attempt.created_at))}</td></tr>; })}</tbody></table></div></section> : <section className="card"><EmptyState title="No payment records yet">Payment attempts will show up here after the PayPal Sandbox integration is implemented. This page does not simulate payments.</EmptyState></section>}
    </main>
  );
}
