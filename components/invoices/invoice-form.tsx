import Link from "next/link";
import type { Customer, Invoice } from "@/types/database";

type InvoiceAction = (formData: FormData) => Promise<void>;
const CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY", "KWD"];

function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function InvoiceForm({ invoice, customers, action, defaultCurrency, defaultCustomerId, error }: { invoice?: Invoice; customers: Customer[]; action: InvoiceAction; defaultCurrency: string; defaultCustomerId?: string; error?: string }) {
  const today = localDate(new Date());
  const due = new Date(`${today}T00:00:00`);
  due.setDate(due.getDate() + 14);
  const defaultDue = localDate(due);
  const currencies = [...new Set([defaultCurrency, ...(invoice ? [invoice.currency] : []), ...CURRENCIES])];

  return (
    <>
      {error && <div className="alert" role="alert">{error}</div>}
      {!customers.length ? <div className="card form-card"><div className="list-empty"><strong>Add a customer first</strong>Every invoice must be associated with a customer record.</div><div className="form-actions"><Link className="button" href="/customers/new">Create customer</Link></div></div> : (
        <form action={action} className="card form-card">
          <div className="form-grid">
            <div className="field"><label htmlFor="invoice_number">Invoice number *</label><input className="input" id="invoice_number" name="invoice_number" defaultValue={invoice?.invoice_number} maxLength={64} required placeholder="e.g. INV-2026-001" /></div>
            <div className="field"><label htmlFor="customer_id">Customer *</label><select className="select" id="customer_id" name="customer_id" defaultValue={invoice?.customer_id ?? defaultCustomerId ?? ""} required><option value="" disabled>Select a customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.company_name ? ` · ${customer.company_name}` : ""}</option>)}</select></div>
            <div className="field full"><label htmlFor="description">Description *</label><textarea className="textarea" id="description" name="description" defaultValue={invoice?.description} maxLength={2000} required placeholder="Describe the work or service" /></div>
            <div className="field"><label htmlFor="amount">Total amount *</label><input className="input" id="amount" name="amount" type="number" min="0.000001" step="any" defaultValue={invoice?.amount} required inputMode="decimal" placeholder="0.00" /></div>
            <div className="field"><label htmlFor="currency">Currency *</label><select className="select" id="currency" name="currency" defaultValue={invoice?.currency ?? defaultCurrency} required>{currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select><span className="field-help">Accepted precision is determined by the selected currency (up to 6 decimal places).</span></div>
            <div className="field"><label htmlFor="issue_date">Issue date *</label><input className="input" id="issue_date" name="issue_date" type="date" defaultValue={invoice?.issue_date ?? today} required /></div>
            <div className="field"><label htmlFor="due_date">Due date *</label><input className="input" id="due_date" name="due_date" type="date" defaultValue={invoice?.due_date ?? defaultDue} required /></div>
            <div className="field"><label htmlFor="status">Status *</label><select className="select" id="status" name="status" defaultValue={invoice?.status === "paid" ? "pending" : invoice?.status ?? "pending"} required><option value="draft">Draft</option><option value="pending">Pending</option><option value="cancelled">Cancelled</option></select><span className="field-help">Paid status is recorded only after a verified payment.</span></div>
          </div>
          <div className="form-actions"><Link className="button secondary" href={invoice ? `/invoices/${invoice.id}` : "/invoices"}>Cancel</Link><button className="button" type="submit">{invoice ? "Save invoice" : "Create invoice"}</button></div>
        </form>
      )}
    </>
  );
}
