import Link from "next/link";
import { requireWorkspace } from "@/lib/data/workspace";
import { getCustomers } from "@/lib/data/queries";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState, QueryFeedback } from "@/components/ui/feedback";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; error?: string; notice?: string }> }) {
  const params = await searchParams;
  const { supabase, business } = await requireWorkspace();
  const result = await getCustomers(supabase, business.id, params.q ?? "");
  return (
    <main className="main-content">
      <PageHeading eyebrow="Relationship management" title="Customers" subtitle="Keep customer details organized alongside the work you invoice." action={<Link className="button" href="/customers/new"><span aria-hidden="true">＋</span> Add customer</Link>} />
      <QueryFeedback error={params.error} notice={params.notice} />
      <div className="toolbar">
        <form className="search-form" action="/customers" method="get"><input className="input" name="q" defaultValue={params.q} placeholder="Search name, company, or email" aria-label="Search customers" /><button className="button secondary" type="submit">Search</button></form>
        <span className="page-subtitle">{result.data?.length ?? 0} customers shown</span>
      </div>
      <section className="card">
        {result.error ? <div className="alert" role="alert">Customer records could not be loaded. Refresh and try again.</div> : result.data?.length ? (
          <div className="table-wrap"><table className="data-table"><thead><tr><th>Customer</th><th>Company</th><th>Email</th><th>Added</th><th><span className="sr-only">Details</span></th></tr></thead><tbody>
            {result.data.map((customer) => <tr key={customer.id}><td className="primary-cell"><Link href={`/customers/${customer.id}`}>{customer.name}</Link></td><td>{customer.company_name || "—"}</td><td>{customer.email}</td><td>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(customer.created_at))}</td><td><Link className="text-link" href={`/customers/${customer.id}`}>View →</Link></td></tr>)}
          </tbody></table></div>
        ) : <EmptyState title={params.q ? "No matching customers" : "No customers yet"}>{params.q ? "Try another name, company, or email address." : "Add your first customer to create an invoice."}<div style={{ marginTop: 14 }}><Link className="button small" href="/customers/new">Add customer</Link></div></EmptyState>}
      </section>
    </main>
  );
}
