import Link from "next/link";
import { createInvoice } from "@/app/actions/invoices";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { PageHeading } from "@/components/ui/page-heading";
import { requireWorkspace } from "@/lib/data/workspace";

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ customer?: string; error?: string }> }) {
  const [{ customer, error }, { supabase, business }] = await Promise.all([searchParams, requireWorkspace()]);
  const { data: customers, error: customersError } = await supabase.from("customers").select("*").eq("business_id", business.id).order("name");
  return <main className="main-content"><PageHeading eyebrow="Invoices" title="Create invoice" subtitle="Record an amount, due date, and customer for this invoice." action={<Link className="button secondary" href="/invoices">Back to invoices</Link>} />{customersError ? <div className="alert">Customer records could not be loaded. Try again.</div> : <InvoiceForm action={createInvoice} customers={customers ?? []} defaultCurrency={business.default_currency} defaultCustomerId={customer} error={error} />}</main>;
}
