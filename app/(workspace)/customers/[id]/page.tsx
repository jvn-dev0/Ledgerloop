import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/data/workspace";
import { formatMoney } from "@/lib/finance/money";
import { PageHeading } from "@/components/ui/page-heading";
import { QueryFeedback } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { LIST_PAGE_SIZE, parseListPage } from "@/lib/data/queries";
import { redirect } from "next/navigation";

export default async function CustomerDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; notice?: string; page?: string }> }) {
  const [{ id }, feedback] = await Promise.all([params, searchParams]);
  const { supabase, business } = await requireWorkspace();
  const { data: customer, error } = await supabase.from("customers").select("*").eq("id", id).eq("business_id", business.id).maybeSingle();
  if (error) {
    console.error("Customer detail query failed", error);
    return <main className="main-content"><div className="alert" role="alert">Customer details could not be loaded. Try again.</div></main>;
  }
  if (!customer) notFound();
  const page = parseListPage(feedback.page);
  const invoiceResult = await supabase.from("invoices").select("id, invoice_number, amount, currency, due_date, status", { count: "exact" }).eq("customer_id", customer.id).eq("business_id", business.id).order("created_at", { ascending: false }).range((page - 1) * LIST_PAGE_SIZE, page * LIST_PAGE_SIZE - 1);
  const total = invoiceResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
  if (page > totalPages) redirect(`/customers/${id}${totalPages > 1 ? `?page=${totalPages}` : ""}`);

  return (
    <main className="main-content">
      <PageHeading eyebrow="Customer record" title={customer.name} subtitle={customer.company_name || "Customer details and associated invoices."} action={<Link className="button" href={`/customers/${customer.id}/edit`}>Edit customer</Link>} />
      <QueryFeedback error={feedback.error} notice={feedback.notice} />
      <div className="detail-grid">
        <section className="card detail-card"><h2 className="card-title">Contact information</h2><div className="detail-block"><div className="detail-label">Email</div><div className="detail-value"><a href={`mailto:${customer.email}`}>{customer.email}</a></div></div><div className="detail-block"><div className="detail-label">Phone</div><div className="detail-value">{customer.phone || "Not provided"}</div></div><div className="detail-block"><div className="detail-label">Collection preference</div><div className="detail-value">{customer.collection_contact_preference ? { email: "Email", phone: "Phone", portal: "Customer portal" }[customer.collection_contact_preference] : "Not specified"}</div></div><div className="detail-block"><div className="detail-label">Company</div><div className="detail-value">{customer.company_name || "Not provided"}</div></div><div className="detail-block"><div className="detail-label">Notes</div><div className="detail-value customer-notes">{customer.notes || "No notes"}</div></div></section>
        <section className="card"><div className="card-head"><div><h2 className="card-title">Invoices</h2><p className="card-subtitle">Linked to this customer</p></div><Link className="text-link" href={`/invoices/new?customer=${customer.id}`}>New invoice</Link></div>
          {invoiceResult.error ? <div className="alert">Invoices could not be loaded.</div> : invoiceResult.data?.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Invoice</th><th>Status</th><th>Total</th></tr></thead><tbody>{invoiceResult.data.map((invoice) => <tr key={invoice.id}><td data-label="Invoice"><Link className="text-link" href={`/invoices/${invoice.id}`}>{invoice.invoice_number}</Link></td><td data-label="Status"><StatusBadge status={invoice.status} overdue={invoice.status === "pending" && invoice.due_date < new Date().toISOString().slice(0, 10)} /></td><td data-label="Total" className="amount-cell">{formatMoney(invoice.amount, invoice.currency)}</td></tr>)}</tbody></table></div> : <div className="list-empty">No invoices for this customer yet.</div>}
        </section>
      </div>
      {!invoiceResult.error && <PaginationControls basePath={`/customers/${id}`} currentPage={page} pageSize={LIST_PAGE_SIZE} totalItems={total} />}
    </main>
  );
}
