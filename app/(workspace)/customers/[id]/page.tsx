import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/data/workspace";
import { formatMoney } from "@/lib/finance/money";
import { PageHeading } from "@/components/ui/page-heading";
import { QueryFeedback } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { LIST_PAGE_SIZE, parseListPage } from "@/lib/data/queries";
import { formatDateTime } from "@/lib/finance/date";
import { redirect } from "next/navigation";

const activityLabels: Record<string, string> = {
  draft_payment_reminder: "Reminder draft created",
  prioritize_collections: "Collection priority reviewed",
  get_business_summary: "Receivables summary reviewed",
  calculate_receivables: "Receivables calculated",
  get_invoice: "Invoice reviewed",
  get_customer: "Customer history reviewed",
};

export default async function CustomerDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; notice?: string; page?: string }> }) {
  const [{ id }, feedback] = await Promise.all([params, searchParams]);
  const { supabase, business } = await requireWorkspace();
  const { data: customer, error } = await supabase.from("customers").select("*").eq("id", id).eq("business_id", business.id).maybeSingle();
  if (error) {
    console.error("Customer detail query failed", { code: error.code ?? "unknown" });
    return <main id="main-content" tabIndex={-1} className="main-content"><div className="alert" role="alert">Customer details could not be loaded. Try again.</div></main>;
  }
  if (!customer) notFound();
  const page = parseListPage(feedback.page);
  const [invoiceResult, summaryResult, paymentResult, activityResult] = await Promise.all([
    supabase.from("invoices").select("id, invoice_number, amount, currency, due_date, status", { count: "exact" }).eq("customer_id", customer.id).eq("business_id", business.id).order("created_at", { ascending: false }).range((page - 1) * LIST_PAGE_SIZE, page * LIST_PAGE_SIZE - 1),
    supabase.rpc("get_customer_financial_summary_for_business", { p_business_id: business.id, p_customer_id: customer.id }),
    supabase.rpc("get_customer_payment_attempts_for_business", { p_business_id: business.id, p_customer_id: customer.id, p_limit: 10 }),
    supabase.rpc("get_customer_collection_activity_for_business", { p_business_id: business.id, p_customer_id: customer.id, p_limit: 10 }),
  ]);
  if (summaryResult.error) console.error("Customer financial summary query failed", { code: summaryResult.error.code ?? "unknown" });
  if (paymentResult.error) console.error("Customer payment history query failed", { code: paymentResult.error.code ?? "unknown" });
  if (activityResult.error) console.error("Customer collection activity query failed", { code: activityResult.error.code ?? "unknown" });
  const total = invoiceResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
  if (page > totalPages) redirect(`/customers/${id}${totalPages > 1 ? `?page=${totalPages}` : ""}`);

  return (
    <main id="main-content" tabIndex={-1} className="main-content">
      <PageHeading eyebrow="Customer record" title={customer.name} subtitle={customer.company_name || "Customer details and associated invoices."} action={<Link className="button" href={`/customers/${customer.id}/edit`}>Edit customer</Link>} />
      <QueryFeedback error={feedback.error} notice={feedback.notice} />
      <section className="customer-summary-grid" aria-label="Customer receivables summary">
        {summaryResult.error ? <div className="alert" role="alert">Receivables summary could not be loaded.</div> : summaryResult.data?.length ? summaryResult.data.map((summary) => <article className="card customer-summary-card" key={summary.currency}>
          <div className="detail-label">Outstanding · {summary.currency}</div>
          <strong className="customer-summary-value">{formatMoney(summary.total_outstanding, summary.currency)}</strong>
          <div className="customer-summary-meta">{summary.open_invoice_count} open {summary.open_invoice_count === 1 ? "invoice" : "invoices"}</div>
          <div className={summary.overdue_invoice_count > 0 ? "customer-overdue" : "customer-summary-meta"}>Overdue: {formatMoney(summary.total_overdue, summary.currency)} · {summary.overdue_invoice_count} {summary.overdue_invoice_count === 1 ? "invoice" : "invoices"}</div>
        </article>) : <div className="card customer-summary-empty"><strong>No open invoices</strong><span>This customer has no pending receivables.</span></div>}
      </section>
      <div className="detail-grid">
        <section className="card detail-card"><h2 className="card-title">Contact information</h2><div className="detail-block"><div className="detail-label">Email</div><div className="detail-value"><a href={`mailto:${customer.email}`}>{customer.email}</a></div></div><div className="detail-block"><div className="detail-label">Phone</div><div className="detail-value">{customer.phone || "Not provided"}</div></div><div className="detail-block"><div className="detail-label">Collection preference</div><div className="detail-value">{customer.collection_contact_preference ? { email: "Email", phone: "Phone", portal: "Customer portal" }[customer.collection_contact_preference] : "Not specified"}</div></div><div className="detail-block"><div className="detail-label">Company</div><div className="detail-value">{customer.company_name || "Not provided"}</div></div><div className="detail-block"><div className="detail-label">Notes</div><div className="detail-value customer-notes">{customer.notes || "No notes"}</div></div></section>
        <section className="card"><div className="card-head"><div><h2 className="card-title">Invoices</h2><p className="card-subtitle">Linked to this customer</p></div><Link className="text-link" href={`/invoices/new?customer=${customer.id}`}>New invoice</Link></div>
          {invoiceResult.error ? <div className="alert">Invoices could not be loaded.</div> : invoiceResult.data?.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Invoice</th><th>Status</th><th>Total</th></tr></thead><tbody>{invoiceResult.data.map((invoice) => <tr key={invoice.id}><td data-label="Invoice"><Link className="text-link" href={`/invoices/${invoice.id}`}>{invoice.invoice_number}</Link></td><td data-label="Status"><StatusBadge status={invoice.status} overdue={invoice.status === "pending" && invoice.due_date < new Date().toISOString().slice(0, 10)} /></td><td data-label="Total" className="amount-cell">{formatMoney(invoice.amount, invoice.currency)}</td></tr>)}</tbody></table></div> : <div className="list-empty">No invoices for this customer yet.</div>}
        </section>
      </div>
      {!invoiceResult.error && <PaginationControls basePath={`/customers/${id}`} currentPage={page} pageSize={LIST_PAGE_SIZE} totalItems={total} />}
      <div className="customer-activity-grid">
        <section className="card">
          <div className="card-head"><div><h2 className="card-title">Payment history</h2><p className="card-subtitle">Latest 10 payment attempts for this customer</p></div></div>
          {paymentResult.error ? <div className="alert" role="alert">Payment history could not be loaded.</div> : paymentResult.data?.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Invoice</th><th>Status</th><th>Reference</th><th>When</th><th className="amount-cell">Amount</th></tr></thead><tbody>{paymentResult.data.map((attempt) => <tr key={attempt.id}>
            <td data-label="Invoice" className="primary-cell"><Link href={`/invoices/${attempt.invoice_id}`}>{attempt.invoice_number}</Link></td>
            <td data-label="Status"><StatusBadge status={attempt.status} /></td>
            <td data-label="Reference" className="reference-cell">{attempt.provider_capture_id ?? attempt.provider_order_id ?? "Not assigned"}</td>
            <td data-label="When">{formatDateTime(attempt.created_at)}</td>
            <td data-label="Amount" className="amount-cell">{formatMoney(attempt.amount, attempt.currency)}</td>
          </tr>)}</tbody></table></div> : <div className="list-empty"><strong>No payment attempts yet</strong>Payment activity will appear here after a real checkout attempt.</div>}
        </section>
        <section className="card">
          <div className="card-head"><div><h2 className="card-title">Collection activity</h2><p className="card-subtitle">Latest saved agent activity for this customer</p></div></div>
          {activityResult.error ? <div className="alert" role="alert">Collection activity could not be loaded.</div> : activityResult.data?.length ? <div className="customer-activity-list">{activityResult.data.map((activity) => <div className="activity-item customer-activity-row" key={activity.activity_id}>
            <div className="activity-icon" aria-hidden="true">↗</div>
            <div className="customer-activity-copy"><Link className="text-link" href={`/invoices/${activity.invoice_id}`}>{activity.invoice_number}</Link><strong>{activityLabels[activity.tool_name] ?? activity.tool_name.replaceAll("_", " ")}</strong><span>{formatDateTime(activity.created_at)}</span></div>
            <StatusBadge status={activity.status} />
          </div>)}</div> : <div className="list-empty"><strong>No collection activity yet</strong>Saved agent actions for this customer will appear here.</div>}
        </section>
      </div>
    </main>
  );
}
