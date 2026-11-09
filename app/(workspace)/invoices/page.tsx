import Link from "next/link";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/data/workspace";
import { getInvoices, LIST_PAGE_SIZE, parseListPage } from "@/lib/data/queries";
import { formatMoney } from "@/lib/finance/money";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState, QueryFeedback } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { formatDate } from "@/lib/finance/date";

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; error?: string; notice?: string }> }) {
  const params = await searchParams;
  const { supabase, business } = await requireWorkspace();
  const page = parseListPage(params.page);
  const invoicesResult = await getInvoices(supabase, business.id, params.q ?? "", page);
  const total = invoicesResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
  if (page > totalPages) {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (totalPages > 1) query.set("page", String(totalPages));
    redirect(`/invoices${query.size ? `?${query.toString()}` : ""}`);
  }
  const customerIds = [...new Set((invoicesResult.data ?? []).map((invoice) => invoice.customer_id))];
  const customersResult = customerIds.length
    ? await supabase.from("customers").select("id, name, company_name").eq("business_id", business.id).in("id", customerIds)
    : { data: [], error: null };
  const customerById = new Map((customersResult.data ?? []).map((customer) => [customer.id, customer]));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="main-content">
      <PageHeading eyebrow="Billing" title="Invoices" subtitle="Create, review, and track outstanding customer invoices." action={<Link className="button" href="/invoices/new"><span aria-hidden="true">＋</span> New invoice</Link>} />
      <QueryFeedback error={params.error ?? (invoicesResult.error ? "Invoice records could not be loaded." : customersResult.error ? "Customer details could not be loaded." : undefined)} notice={params.notice} />
      <div className="toolbar">
        <form className="search-form" action="/invoices" method="get"><input className="input" name="q" defaultValue={params.q} placeholder="Search invoice number" aria-label="Search invoices" /><button className="button secondary" type="submit">Search</button></form>
        <span className="page-subtitle">{total} {total === 1 ? "invoice" : "invoices"}</span>
      </div>
      <section className="card">
        {invoicesResult.error ? <div className="alert" role="alert">Invoice records could not be loaded. Refresh and try again.</div> : invoicesResult.data?.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Invoice</th><th>Customer</th><th>Issue date</th><th>Due date</th><th>Status</th><th className="amount-cell">Amount</th></tr></thead><tbody>
          {invoicesResult.data.map((invoice) => {
            const customer = customerById.get(invoice.customer_id);
            const overdue = invoice.status === "pending" && invoice.due_date < today;
            return <tr key={invoice.id}><td className="primary-cell"><Link href={`/invoices/${invoice.id}`}>{invoice.invoice_number}</Link><span className="secondary-cell">{invoice.description}</span></td><td>{customer?.name ?? "Customer unavailable"}{customer?.company_name && <span className="secondary-cell">{customer.company_name}</span>}</td><td>{formatDate(invoice.issue_date)}</td><td>{formatDate(invoice.due_date)}</td><td><StatusBadge status={invoice.status} overdue={overdue} /></td><td className="amount-cell">{formatMoney(invoice.amount, invoice.currency)}</td></tr>;
          })}
        </tbody></table></div> : <EmptyState title={params.q ? "No matching invoices" : "No invoices yet"}>{params.q ? "Try another invoice number." : "Create an invoice from a real customer record to start tracking receivables."}<div style={{ marginTop: 14 }}><Link className="button small" href="/invoices/new">Create invoice</Link></div></EmptyState>}
      </section>
      {!invoicesResult.error && <PaginationControls basePath="/invoices" currentPage={page} pageSize={LIST_PAGE_SIZE} totalItems={total} query={params.q} />}
    </main>
  );
}
