import Link from "next/link";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/data/workspace";
import { formatMoney } from "@/lib/finance/money";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { LIST_PAGE_SIZE, parseListPage, parsePaymentStatusFilter, PAYMENT_STATUS_FILTERS } from "@/lib/data/queries";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { formatDate } from "@/lib/finance/date";

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ page?: string; status?: string }> }) {
  const params = await searchParams;
  const { supabase, business } = await requireWorkspace();
  const page = parseListPage(params.page);
  const status = parsePaymentStatusFilter(params.status);
  let attemptsQuery = supabase.from("payment_attempts").select("*", { count: "exact" }).eq("business_id", business.id).order("created_at", { ascending: false });
  if (status) attemptsQuery = attemptsQuery.eq("status", status);
  const attemptsResult = await attemptsQuery.range((page - 1) * LIST_PAGE_SIZE, page * LIST_PAGE_SIZE - 1);
  const total = attemptsResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
  if (page > totalPages) {
    const query = new URLSearchParams();
    if (status) query.set("status", status);
    if (totalPages > 1) query.set("page", String(totalPages));
    redirect(`/payments${query.size ? `?${query.toString()}` : ""}`);
  }
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
      <div className="toolbar">
        <form className="filter-form payment-filter" action="/payments" method="get">
          <label className="sr-only" htmlFor="payment-status">Filter payments by status</label>
          <select className="select" id="payment-status" name="status" defaultValue={status ?? ""}>
            <option value="">All statuses</option>
            {PAYMENT_STATUS_FILTERS.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())}</option>)}
          </select>
          <button className="button secondary" type="submit">Apply</button>
        </form>
        <span className="page-subtitle">{total} {total === 1 ? "payment attempt" : "payment attempts"}</span>
      </div>
      {attemptsResult.error || relatedError ? <div className="alert" role="alert">Payment records could not be loaded. Refresh and try again.</div> : attemptsResult.data?.length ? <section className="card"><div className="table-wrap"><table className="data-table"><thead><tr><th>Invoice</th><th>Customer</th><th>Provider</th><th>PayPal order</th><th>Capture</th><th>Status</th><th className="amount-cell">Amount</th><th>Created</th></tr></thead><tbody>{attemptsResult.data.map((attempt) => { const invoice = invoiceById.get(attempt.invoice_id); return <tr key={attempt.id}><td data-label="Invoice" className="primary-cell">{invoice ? <Link href={`/invoices/${attempt.invoice_id}`}>{invoice.invoice_number}</Link> : "Invoice unavailable"}</td><td data-label="Customer">{invoice ? customerById.get(invoice.customer_id)?.name ?? "Customer unavailable" : "—"}</td><td data-label="Provider">{attempt.provider.toUpperCase()}</td><td data-label="PayPal order" className="reference-cell">{attempt.provider_order_id ?? "Not created"}</td><td data-label="Capture" className="reference-cell">{attempt.provider_capture_id ?? "—"}</td><td data-label="Status"><StatusBadge status={attempt.status.replaceAll("_", " ")} /></td><td data-label="Amount" className="amount-cell">{formatMoney(attempt.amount, attempt.currency)}</td><td data-label="Created">{formatDate(attempt.created_at)}</td></tr>; })}</tbody></table></div></section> : <section className="card"><EmptyState title={status ? "No matching payments" : "No payment records yet"}>{status ? "Choose another payment status to review different attempts." : "Payment attempts appear here when a customer starts checkout. No transactions are fabricated."}</EmptyState></section>}
      {!attemptsResult.error && !relatedError && <PaginationControls basePath="/payments" currentPage={page} pageSize={LIST_PAGE_SIZE} totalItems={total} filters={{ status }} />}
    </main>
  );
}
