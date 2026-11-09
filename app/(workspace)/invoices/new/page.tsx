import Link from "next/link";
import { createInvoice } from "@/app/actions/invoices";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { PageHeading } from "@/components/ui/page-heading";
import { requireWorkspace } from "@/lib/data/workspace";

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ customer?: string; error?: string }> }) {
  const [{ customer, error }, { supabase, business }] = await Promise.all([searchParams, requireWorkspace()]);
  const [customerCheck, selectedCustomer] = await Promise.all([
    supabase.from("customers").select("id").eq("business_id", business.id).limit(1),
    customer ? supabase.from("customers").select("id, name, company_name, email").eq("id", customer).eq("business_id", business.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  return <main className="main-content"><PageHeading eyebrow="Invoices" title="Create invoice" subtitle="Record an amount, due date, and customer for this invoice." action={<Link className="button secondary" href="/invoices">Back to invoices</Link>} />{customerCheck.error ? <div className="alert" role="alert">Customer records could not be loaded. Try again.</div> : <InvoiceForm action={createInvoice} hasCustomers={Boolean(customerCheck.data?.length)} initialCustomer={selectedCustomer.data} defaultCurrency={business.default_currency} error={error} />}</main>;
}
