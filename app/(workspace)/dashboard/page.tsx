import Link from "next/link";
import { requireWorkspace } from "@/lib/data/workspace";
import { getDashboardData } from "@/lib/data/queries";
import { formatMoney } from "@/lib/finance/money";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";

export default async function DashboardPage() {
  const { supabase, business } = await requireWorkspace();
  let data;
  try {
    data = await getDashboardData(supabase, business.id);
  } catch (error) {
    console.error("Dashboard data could not be loaded", error);
    return <main className="main-content"><PageHeading eyebrow="Overview" title="Dashboard" subtitle="Your receivables at a glance." /><div className="alert" role="alert">Dashboard records could not be loaded. Confirm that the Supabase migration has been applied, then refresh.</div></main>;
  }

  const hasInvoices = data.summary.some((row) => row.invoice_count > 0);
  return (
    <main className="main-content">
      <PageHeading eyebrow="Overview" title="Dashboard" subtitle="A clear view of invoices issued, payments recorded, and amounts still due." action={<Link className="button" href="/invoices/new">＋ New invoice</Link>} />
      {!hasInvoices ? <section className="card"><EmptyState title="Your receivables start here">There are no issued invoices in this workspace yet. Add a real customer and create an invoice to see your financial summary.<div style={{ display: "flex", justifyContent: "center", gap: 9, marginTop: 16 }}><Link className="button secondary small" href="/customers/new">Add customer</Link><Link className="button small" href="/invoices/new">Create invoice</Link></div></EmptyState></section> : data.summary.filter((row) => row.invoice_count > 0).map((row) => (
        <section key={row.currency} style={{ marginBottom: 19 }}>
          <div className="card-head" style={{ marginBottom: 11, padding: "0 1px", border: 0 }}><div><h2 className="card-title">Receivables in {row.currency}</h2><p className="card-subtitle">Issued invoices only; cancelled and draft invoices are excluded.</p></div><span className="badge">{row.invoice_count} invoices · {row.overdue_count} overdue</span></div>
          <div className="stat-grid">
            <article className="card stat-card"><div className="stat-label">Total invoiced <span className="stat-icon">▤</span></div><div className="stat-value">{formatMoney(row.total_invoiced, row.currency)}</div><div className="stat-note">Pending and paid invoices</div></article>
            <article className="card stat-card success"><div className="stat-label">Total paid <span className="stat-icon">✓</span></div><div className="stat-value">{formatMoney(row.total_paid, row.currency)}</div><div className="stat-note">Recorded as verified paid</div></article>
            <article className="card stat-card warning"><div className="stat-label">Outstanding <span className="stat-icon">◷</span></div><div className="stat-value">{formatMoney(row.total_outstanding, row.currency)}</div><div className="stat-note">Pending invoices</div></article>
            <article className="card stat-card danger"><div className="stat-label">Overdue <span className="stat-icon">!</span></div><div className="stat-value">{formatMoney(row.total_overdue, row.currency)}</div><div className="stat-note">Past due date, still pending</div></article>
          </div>
        </section>
      ))}
      <div className="content-grid">
        <section className="card"><div className="card-head"><div><h2 className="card-title">Recent invoices</h2><p className="card-subtitle">Latest records from your business</p></div><Link className="text-link" href="/invoices">All invoices →</Link></div>
          {data.invoices.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Invoice</th><th>Customer</th><th>Due date</th><th>Status</th><th className="amount-cell">Amount</th></tr></thead><tbody>{data.invoices.map((invoice) => { const customer = data.customers.get(invoice.customer_id); const overdue = invoice.status === "pending" && invoice.due_date < new Date().toISOString().slice(0, 10); return <tr key={invoice.id}><td className="primary-cell"><Link href={`/invoices/${invoice.id}`}>{invoice.invoice_number}</Link></td><td>{customer?.name ?? "Customer unavailable"}</td><td>{invoice.due_date}</td><td><StatusBadge status={invoice.status} overdue={overdue} /></td><td className="amount-cell">{formatMoney(invoice.amount, invoice.currency)}</td></tr>; })}</tbody></table></div> : <div className="list-empty">No invoice records yet.</div>}
        </section>
        <section className="card"><div className="card-head"><div><h2 className="card-title">Payment activity</h2><p className="card-subtitle">Verified payment records</p></div><Link className="text-link" href="/payments">View all →</Link></div>
          {data.activity.length ? data.activity.map((item) => <div className="activity-item" key={item.id}><div className="activity-icon">↗</div><div style={{ minWidth: 0, flex: 1 }}><strong>{item.provider.toUpperCase()} · {formatMoney(item.amount, item.currency)}</strong><span>{item.status.replaceAll("_", " ")} · {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(item.created_at))}</span></div></div>) : <EmptyState title="No payment activity yet">Payments will appear here after a verified payment is recorded.</EmptyState>}
        </section>
      </div>
    </main>
  );
}
