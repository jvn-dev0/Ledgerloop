import Link from "next/link";
import { createCustomer } from "@/app/actions/customers";
import { CustomerForm } from "@/components/customers/customer-form";
import { PageHeading } from "@/components/ui/page-heading";

export default async function NewCustomerPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="main-content"><PageHeading eyebrow="Customers" title="Add customer" subtitle="Add the contact details you need for invoice records." action={<Link className="button secondary" href="/customers">Back to customers</Link>} /><CustomerForm action={createCustomer} error={error} /></main>;
}
