import Link from "next/link";
import type { Customer } from "@/types/database";

type CustomerAction = (formData: FormData) => Promise<void>;

export function CustomerForm({ customer, action, error }: { customer?: Customer; action: CustomerAction; error?: string }) {
  return (
    <>
      {error && <div className="alert" role="alert">{error}</div>}
      <form action={action} className="card form-card">
        <div className="form-grid">
          <div className="field"><label htmlFor="name">Customer name *</label><input className="input" id="name" name="name" defaultValue={customer?.name} maxLength={160} required autoComplete="name" /></div>
          <div className="field"><label htmlFor="email">Email address *</label><input className="input" id="email" name="email" type="email" defaultValue={customer?.email} maxLength={254} required autoComplete="email" /></div>
          <div className="field"><label htmlFor="company_name">Company</label><input className="input" id="company_name" name="company_name" defaultValue={customer?.company_name ?? ""} maxLength={160} autoComplete="organization" /></div>
          <div className="field"><label htmlFor="phone">Phone</label><input className="input" id="phone" name="phone" type="tel" defaultValue={customer?.phone ?? ""} maxLength={40} autoComplete="tel" /></div>
          <div className="field"><label htmlFor="collection_contact_preference">Preferred collection contact</label><select className="input" id="collection_contact_preference" name="collection_contact_preference" defaultValue={customer?.collection_contact_preference ?? ""}><option value="">Not specified</option><option value="email">Email</option><option value="phone">Phone</option><option value="portal">Customer portal</option></select></div>
          <div className="field full"><label htmlFor="notes">Notes</label><textarea className="textarea" id="notes" name="notes" defaultValue={customer?.notes ?? ""} maxLength={4000} /></div>
        </div>
        <div className="form-actions"><Link className="button secondary" href={customer ? `/customers/${customer.id}` : "/customers"}>Cancel</Link><button className="button" type="submit">{customer ? "Save customer" : "Create customer"}</button></div>
      </form>
    </>
  );
}
