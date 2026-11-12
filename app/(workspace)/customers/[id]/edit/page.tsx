import Link from "next/link";
import { notFound } from "next/navigation";
import { updateCustomer } from "@/app/actions/customers";
import { CustomerForm } from "@/components/customers/customer-form";
import { PageHeading } from "@/components/ui/page-heading";
import { requireWorkspace } from "@/lib/data/workspace";

export default async function EditCustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, { error: feedback }] = await Promise.all([params, searchParams]);
  const { supabase, business } = await requireWorkspace();
  const { data: customer, error } = await supabase.from("customers").select("*").eq("id", id).eq("business_id", business.id).maybeSingle();
  if (error) throw new Error(`Customer could not be loaded: ${error.message}`);
  if (!customer) notFound();
  const action = updateCustomer.bind(null, customer.id);
  return <main id="main-content" tabIndex={-1} className="main-content"><PageHeading eyebrow="Customers" title="Edit customer" subtitle={`Update the record for ${customer.name}.`} action={<Link className="button secondary" href={`/customers/${customer.id}`}>Cancel</Link>} /><CustomerForm customer={customer} action={action} error={feedback} /></main>;
}
