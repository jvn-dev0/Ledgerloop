import Link from "next/link";
import { notFound } from "next/navigation";
import { updateInvoice } from "@/app/actions/invoices";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { PageHeading } from "@/components/ui/page-heading";
import { requireWorkspace } from "@/lib/data/workspace";

export default async function EditInvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, { error: feedback }, { supabase, business }] = await Promise.all([params, searchParams, requireWorkspace()]);
  const invoiceResult = await supabase.from("invoices").select("*").eq("id", id).eq("business_id", business.id).maybeSingle();
  if (invoiceResult.error) throw new Error(`Invoice could not be loaded: ${invoiceResult.error.message}`);
  if (!invoiceResult.data) notFound();
  if (invoiceResult.data.status === "paid") return <main className="main-content"><PageHeading eyebrow="Invoices" title="Invoice is paid" subtitle="A verified paid invoice is locked to preserve its financial record." action={<Link className="button secondary" href={`/invoices/${id}`}>Back to invoice</Link>} /></main>;
  const customerResult = await supabase.from("customers").select("id, name, company_name, email").eq("id", invoiceResult.data.customer_id).eq("business_id", business.id).maybeSingle();
  if (customerResult.error) throw new Error(`Invoice customer could not be loaded: ${customerResult.error.message}`);
  const action = updateInvoice.bind(null, invoiceResult.data.id);
  return <main className="main-content"><PageHeading eyebrow="Invoices" title="Edit invoice" subtitle={`Update ${invoiceResult.data.invoice_number}.`} action={<Link className="button secondary" href={`/invoices/${id}`}>Cancel</Link>} /><InvoiceForm invoice={invoiceResult.data} initialCustomer={customerResult.data} hasCustomers={Boolean(customerResult.data)} action={action} defaultCurrency={business.default_currency} error={feedback} /></main>;
}
