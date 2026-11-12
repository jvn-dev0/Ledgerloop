import Link from "next/link";
import type { Invoice } from "@/types/database";
import { CustomerPicker, type CustomerOption } from "@/components/invoices/customer-picker";
import { SUPPORTED_CURRENCIES } from "@/lib/finance/money";

type InvoiceAction = (formData: FormData) => Promise<void>;
function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function InvoiceForm({ invoice, initialCustomer, hasCustomers, action, defaultCurrency, error }: { invoice?: Invoice; initialCustomer?: CustomerOption | null; hasCustomers: boolean; action: InvoiceAction; defaultCurrency: string; error?: string }) {
  const today = localDate(new Date());
  const due = new Date(`${today}T00:00:00`);
  due.setDate(due.getDate() + 14);
  const defaultDue = localDate(due);
  const currencies = [...new Set([defaultCurrency, ...(invoice ? [invoice.currency] : []), ...SUPPORTED_CURRENCIES])];

  return (
    <>
      {error && <div className="alert" role="alert">{error}</div>}
      {!hasCustomers ? <div className="card form-card"><div className="list-empty"><strong>Add a customer first</strong>Every invoice must be associated with a customer record.</div><div className="form-actions"><Link className="button" href="/customers/new">Create customer</Link></div></div> : (
        <form action={action} className="card form-card">
          <div className="form-grid">
            <div className="field"><label htmlFor="invoice_number">Invoice number *</label><input className="input" id="invoice_number" name="invoice_number" defaultValue={invoice?.invoice_number} maxLength={64} required placeholder="e.g. INV-2026-001" /></div>
            <div className="field"><CustomerPicker key={initialCustomer?.id ?? "customer-picker"} initialCustomer={initialCustomer} /></div>
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
