import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/data/workspace";
import { formatMoney } from "@/lib/finance/money";
import { PageHeading } from "@/components/ui/page-heading";
import { QueryFeedback } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { PaymentLinkManager } from "@/components/invoices/payment-link-manager";
import { formatDate } from "@/lib/finance/date";

export default async function InvoiceDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; notice?: string }> }) {
  const [{ id }, feedback] = await Promise.all([params, searchParams]);
  const { supabase, business } = await requireWorkspace();
  const { data: invoice, error } = await supabase.from("invoices").select("*").eq("id", id).eq("business_id", business.id).maybeSingle();
  if (error) {
    console.error("Invoice detail query failed", error);
    return <main className="main-content"><div className="alert" role="alert">Invoice details could not be loaded. Try again.</div></main>;
  }
  if (!invoice) notFound();
  const { data: customer, error: customerError } = await supabase.from("customers").select("id, name, email, company_name").eq("id", invoice.customer_id).eq("business_id", business.id).maybeSingle();
  if (customerError) console.error("Invoice customer query failed", customerError);
  const overdue = invoice.status === "pending" && invoice.due_date < new Date().toISOString().slice(0, 10);

  return (
    <main className="main-content">
      <PageHeading eyebrow="Invoice record" title={invoice.invoice_number} subtitle={invoice.description} action={invoice.status === "paid" ? undefined : <Link className="button" href={`/invoices/${invoice.id}/edit`}>Edit invoice</Link>} />
      <QueryFeedback error={feedback.error ?? (customerError ? "Customer details could not be loaded." : undefined)} notice={feedback.notice} />
      <div className="detail-grid">
        <section className="card detail-card"><h2 className="card-title">Invoice details</h2><div className="detail-block"><div className="detail-label">Status</div><div className="detail-value"><StatusBadge status={invoice.status} overdue={overdue} /></div></div><div className="detail-block"><div className="detail-label">Total</div><div className="detail-value amount-large">{formatMoney(invoice.amount, invoice.currency)}</div></div><div className="detail-block"><div className="detail-label">Issue date</div><div className="detail-value">{formatDate(invoice.issue_date)}</div></div><div className="detail-block"><div className="detail-label">Due date</div><div className="detail-value">{formatDate(invoice.due_date)}{overdue && <span className="overdue-note">Overdue</span>}</div></div><div className="detail-block"><div className="detail-label">Outstanding balance</div><div className="detail-value">{invoice.status === "pending" ? formatMoney(invoice.amount, invoice.currency) : formatMoney("0", invoice.currency)}</div></div></section>
        <section className="card detail-card"><h2 className="card-title">Bill to</h2>{customer ? <><div className="detail-block"><div className="detail-value"><Link className="text-link" href={`/customers/${customer.id}`}>{customer.name}</Link></div></div><div className="detail-block"><div className="detail-label">Company</div><div className="detail-value">{customer.company_name || "—"}</div></div><div className="detail-block"><div className="detail-label">Email</div><div className="detail-value"><a href={`mailto:${customer.email}`}>{customer.email}</a></div></div></> : <p className="page-subtitle">Customer details are unavailable.</p>}</section>
      </div>
      {invoice.status === "pending" && <PaymentLinkManager invoiceId={invoice.id} />}
    </main>
  );
}
