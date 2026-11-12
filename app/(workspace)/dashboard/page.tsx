import Link from "next/link";
import { requireWorkspace } from "@/lib/data/workspace";
import { getDashboardData } from "@/lib/data/queries";
import { formatMoney } from "@/lib/finance/money";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { SummaryMetric } from "@/components/dashboard/summary-metric";
import { formatDate, formatDateTime } from "@/lib/finance/date";
import { daysBetween } from "@/lib/agent/collections";

export default async function DashboardPage() {
  const { supabase, business } = await requireWorkspace();
  let data;
  try {
    data = await getDashboardData(supabase, business.id);
  } catch (error) {
    console.error("Dashboard data could not be loaded", { name: error instanceof Error ? error.name : "unknown" });
    return <main id="main-content" tabIndex={-1} className="main-content"><PageHeading eyebrow="Overview" title="Dashboard" subtitle="Your receivables at a glance." /><div className="alert" role="alert">Dashboard records could not be loaded. Confirm that the Supabase migration has been applied, then refresh.</div></main>;
  }

  const hasInvoices = data.summary.some((row) => row.draft_count + row.pending_count + row.paid_count + row.cancelled_count > 0);
  return (
      <main id="main-content" tabIndex={-1} className="main-content">
      <PageHeading eyebrow="Overview" title="Dashboard" subtitle="A clear view of invoices issued, payments recorded, and amounts still due." action={<Link className="button" href="/invoices/new">＋ New invoice</Link>} />
      {!hasInvoices ? <section className="card"><EmptyState title="Your receivables start here">There are no invoices in this workspace yet. Add a real customer and create an invoice to see your financial summary.<div className="empty-actions"><Link className="button secondary small" href="/customers/new">Add customer</Link><Link className="button small" href="/invoices/new">Create invoice</Link></div></EmptyState></section> : data.summary.map((row) => {
        const statusRows = [
          { label: "Pending", count: row.pending_count, tone: "pending" },
          { label: "Paid", count: row.paid_count, tone: "paid" },
          { label: "Draft", count: row.draft_count, tone: "draft" },
          { label: "Cancelled", count: row.cancelled_count, tone: "cancelled" },
        ];
        const allCount = statusRows.reduce((sum, status) => sum + status.count, 0);
        return <section key={row.currency} className="currency-section">
          <div className="dashboard-section-head"><div><h2 className="section-title">Receivables <span>{row.currency}</span></h2><p className="card-subtitle">Issued totals exclude draft and cancelled invoices.</p></div><span className="section-count">{row.invoice_count} issued · {row.overdue_count} overdue</span></div>
          <div className="stat-grid">
            <SummaryMetric label="Total invoiced" value={row.total_invoiced} currency={row.currency} note="Pending and paid invoices" icon="document" />
            <SummaryMetric label="Total collected" value={row.total_paid} currency={row.currency} note="Verified captured payments" tone="success" icon="check" />
            <SummaryMetric label="Outstanding" value={row.total_outstanding} currency={row.currency} note="Open invoice balances" tone="warning" icon="clock" />
            <SummaryMetric label="Overdue" value={row.total_overdue} currency={row.currency} note="Past due and still pending" tone="danger" icon="alert" />
          </div>
          <section className="card distribution-card" aria-labelledby={`distribution-${row.currency}`}>
            <div className="card-head"><div><h3 className="card-title" id={`distribution-${row.currency}`}>Invoice status</h3><p className="card-subtitle">Current records by status</p></div><span className="distribution-total">{allCount} total</span></div>
            <div className="distribution-list">{statusRows.map((status) => <div className="distribution-row" key={status.label}><span className="distribution-label"><span className={`distribution-dot ${status.tone}`} />{status.label}</span><div className="distribution-track" aria-hidden="true"><span className={`distribution-fill ${status.tone}`} style={{ width: `${allCount ? Math.round((status.count / allCount) * 100) : 0}%` }} /></div><strong>{status.count}</strong></div>)}</div>
          </section>
        </section>;
      })}
      <div className="dashboard-operations-grid">
        <section className="card">
          <div className="card-head"><div><h2 className="card-title">Collection priorities</h2><p className="card-subtitle">Longest overdue invoices first</p></div><Link className="text-link" href="/assistant">Open assistant</Link></div>
          {data.priorityInvoicesError ? <div className="alert" role="alert">Overdue invoices could not be loaded.</div> : data.priorityInvoices.length ? <div className="priority-list">
            {data.priorityInvoices.map((invoice) => {
              const overdueDays = daysBetween(invoice.due_date, data.today) ?? 0;
              const customer = data.customerById.get(invoice.customer_id);
              return <Link className="priority-row" href={`/invoices/${invoice.id}`} key={invoice.id}>
                <span className="priority-invoice"><strong>{invoice.invoice_number}</strong><span>{customer?.name ?? "Customer unavailable"} · Due {formatDate(invoice.due_date)}</span></span>
                <span className="priority-amount"><strong>{formatMoney(invoice.amount, invoice.currency)}</strong><span>{overdueDays} days overdue</span></span>
              </Link>;
            })}
          </div> : <EmptyState title="No overdue invoices">Pending invoices past their due dates will appear here.</EmptyState>}
          {!data.priorityInvoicesError && data.priorityInvoiceCount > data.priorityInvoices.length && <div className="priority-footer">Showing the 5 longest overdue of {data.priorityInvoiceCount}</div>}
        </section>
        <section className="card">
          <div className="card-head"><div><h2 className="card-title">Pending approvals</h2><p className="card-subtitle">Human review before an action proceeds</p></div><Link className="text-link" href="/assistant">Review <span aria-hidden="true">→</span></Link></div>
          {data.pendingApprovalsError ? <div className="alert" role="alert">Approval status could not be loaded. Confirm the Day 3 migration has been applied.</div> : data.pendingApprovals.length ? <div className="priority-list">
            {data.pendingApprovals.map((approval) => {
              const invoice = data.invoiceById.get(approval.invoice_id);
              return <Link className="approval-row" href="/assistant" key={approval.id}>
                <span><strong>{invoice?.invoice_number ?? "Invoice unavailable"}</strong><span>{approval.reason}</span></span>
                <time dateTime={approval.created_at}>{formatDateTime(approval.created_at)}</time>
              </Link>;
            })}
          </div> : <EmptyState title="No approvals waiting">The agent will show proposed actions here for review before execution.</EmptyState>}
          {!data.pendingApprovalsError && data.pendingApprovalCount > data.pendingApprovals.length && <div className="priority-footer">Showing 5 of {data.pendingApprovalCount} pending approvals</div>}
        </section>
      </div>
      <div className="content-grid">
        <section className="card"><div className="card-head"><div><h2 className="card-title">Recent invoices</h2><p className="card-subtitle">Latest records from your business</p></div><Link className="text-link" href="/invoices">All invoices <span aria-hidden="true">→</span></Link></div>
          {data.invoices.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Invoice</th><th>Customer</th><th>Due date</th><th>Status</th><th className="amount-cell">Amount</th></tr></thead><tbody>{data.invoices.map((invoice) => { const customer = data.customerById.get(invoice.customer_id); const overdue = invoice.status === "pending" && invoice.due_date < new Date().toISOString().slice(0, 10); return <tr key={invoice.id}><td data-label="Invoice" className="primary-cell"><Link href={`/invoices/${invoice.id}`}>{invoice.invoice_number}</Link></td><td data-label="Customer">{customer?.name ?? "Customer unavailable"}</td><td data-label="Due date">{formatDate(invoice.due_date)}</td><td data-label="Status"><StatusBadge status={invoice.status} overdue={overdue} /></td><td data-label="Amount" className="amount-cell">{formatMoney(invoice.amount, invoice.currency)}</td></tr>; })}</tbody></table></div> : <EmptyState title="No invoice records yet">Create an invoice to start tracking receivables.</EmptyState>}
        </section>
        <section className="card"><div className="card-head"><div><h2 className="card-title">Recent payments</h2><p className="card-subtitle">Latest payment attempts and captures</p></div><Link className="text-link" href="/payments">View all <span aria-hidden="true">→</span></Link></div>
          {data.activity.length ? data.activity.map((item) => { const invoice = data.invoiceById.get(item.invoice_id); const customer = invoice ? data.customerById.get(invoice.customer_id) : undefined; return <div className="activity-item" key={item.id}><div className="activity-icon" aria-hidden="true">{item.status === "captured" ? "✓" : "↗"}</div><div className="activity-copy"><strong>{invoice ? <Link href={`/invoices/${invoice.id}`}>{invoice.invoice_number}</Link> : "Invoice unavailable"} <span>· {item.provider.toUpperCase()}</span></strong><p>{customer?.name ?? "Customer unavailable"} · {formatMoney(item.amount, item.currency)}</p><span>{item.status.replaceAll("_", " ")} · {formatDateTime(item.created_at)}</span></div></div>; }) : <EmptyState title="No payment activity yet">Payment attempts and verified captures will appear here.</EmptyState>}
        </section>
      </div>
    </main>
  );
}
