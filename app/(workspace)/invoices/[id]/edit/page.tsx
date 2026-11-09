import Link from "next/link";
import { notFound } from "next/navigation";
import { updateInvoice } from "@/app/actions/invoices";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { PageHeading } from "@/components/ui/page-heading";
import { requireWorkspace } from "@/lib/data/workspace";

export default async function EditInvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, { error: feedback }, { supabase, business }] = await Promise.all([params, searchParams, requireWorkspace()]);
  const [invoiceResult, customersResult] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).eq("business_id", business.id).maybeSingle(),
    supabase.from("customers").select("*").eq("business_id", business.id).order("name"),
  ]);
  if (invoiceResult.error) throw new Error(`Invoice could not be loaded: ${invoiceResult.error.message}`);
  if (!invoiceResult.data) notFound();
  if (invoiceResult.data.status === "paid") return <main className="main-content"><PageHeading eyebrow="Invoices" title="Invoice is paid" subtitle="A verified paid invoice is locked to preserve its financial record." action={<Link className="button secondary" href={`/invoices/${id}`}>Back to invoice</Link>} /></main>;
  if (customersResult.error) throw new Error(`Customers could not be loaded: ${customersResult.error.message}`);
  const action = updateInvoice.bind(null, invoiceResult.data.id);
  return <main className="main-content"><PageHeading eyebrow="Invoices" title="Edit invoice" subtitle={`Update ${invoiceResult.data.invoice_number}.`} action={<Link className="button secondary" href={`/invoices/${id}`}>Cancel</Link>} /><InvoiceForm invoice={invoiceResult.data} customers={customersResult.data ?? []} action={action} defaultCurrency={business.default_currency} error={feedback} /></main>;
}
