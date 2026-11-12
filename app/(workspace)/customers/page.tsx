import Link from "next/link";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/data/workspace";
import { getCustomers, LIST_PAGE_SIZE, parseListPage } from "@/lib/data/queries";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState, QueryFeedback } from "@/components/ui/feedback";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { formatDate } from "@/lib/finance/date";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; error?: string; notice?: string }> }) {
  const params = await searchParams;
  const { supabase, business } = await requireWorkspace();
  const page = parseListPage(params.page);
  const result = await getCustomers(supabase, business.id, params.q ?? "", page);
  const total = result.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
  if (page > totalPages) {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (totalPages > 1) query.set("page", String(totalPages));
    redirect(`/customers${query.size ? `?${query.toString()}` : ""}`);
  }
  return (
    <main className="main-content">
      <PageHeading eyebrow="Relationship management" title="Customers" subtitle="Keep customer details organized alongside the work you invoice." action={<Link className="button" href="/customers/new"><span aria-hidden="true">＋</span> Add customer</Link>} />
      <QueryFeedback error={params.error} notice={params.notice} />
      <div className="toolbar">
        <form className="search-form" action="/customers" method="get"><input className="input" name="q" defaultValue={params.q} placeholder="Search name, company, or email" aria-label="Search customers" /><button className="button secondary" type="submit">Search</button></form>
        <span className="page-subtitle">{total} {total === 1 ? "customer" : "customers"}</span>
      </div>
      <section className="card">
        {result.error ? <div className="alert" role="alert">Customer records could not be loaded. Refresh and try again.</div> : result.data?.length ? (
          <div className="table-wrap"><table className="data-table"><thead><tr><th>Customer</th><th>Company</th><th>Email</th><th>Added</th><th><span className="sr-only">Details</span></th></tr></thead><tbody>
            {result.data.map((customer) => <tr key={customer.id}><td data-label="Customer" className="primary-cell"><Link href={`/customers/${customer.id}`}>{customer.name}</Link></td><td data-label="Company">{customer.company_name || "—"}</td><td data-label="Email">{customer.email}</td><td data-label="Added">{formatDate(customer.created_at)}</td><td data-label="Details"><Link className="text-link" href={`/customers/${customer.id}`}>View details</Link></td></tr>)}
          </tbody></table></div>
        ) : <EmptyState title={params.q ? "No matching customers" : "No customers yet"}>{params.q ? "Try another name, company, or email address." : "Add your first customer to create an invoice."}<div style={{ marginTop: 14 }}><Link className="button small" href="/customers/new">Add customer</Link></div></EmptyState>}
      </section>
      {!result.error && <PaginationControls basePath="/customers" currentPage={page} pageSize={LIST_PAGE_SIZE} totalItems={total} query={params.q} />}
    </main>
  );
}
