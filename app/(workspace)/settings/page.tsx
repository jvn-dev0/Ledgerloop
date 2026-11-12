import { updateBusinessSettings } from "@/app/actions/business";
import { SubmitButton } from "@/components/ui/submit-button";
import { PageHeading } from "@/components/ui/page-heading";
import { SUPPORTED_CURRENCIES } from "@/lib/finance/money";
import { requireWorkspace } from "@/lib/data/workspace";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const [params, { business, email }] = await Promise.all([searchParams, requireWorkspace()]);
  const currencies = [...new Set([business.default_currency, ...SUPPORTED_CURRENCIES])];

  return (
    <main id="main-content" tabIndex={-1} className="main-content">
      <PageHeading eyebrow="Workspace" title="Settings" subtitle="Manage the business profile used in your LedgerLoop workspace." />
      {params.error && <div className="alert" role="alert">{params.error}</div>}
      {params.notice && <div className="notice" role="status" aria-live="polite">{params.notice}</div>}
      <section className="card form-card settings-card">
        <div className="card-head"><div><h2 className="card-title">Business profile</h2><p className="card-subtitle">These details are saved to your business record.</p></div></div>
        <form action={updateBusinessSettings}>
          <div className="form-grid">
            <div className="field"><label htmlFor="business-name">Business name</label><input className="input" id="business-name" name="name" autoComplete="organization" maxLength={120} defaultValue={business.name} required /></div>
            <div className="field"><label htmlFor="default-currency">Default invoice currency</label><select className="select" id="default-currency" name="default_currency" defaultValue={business.default_currency}>{currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select><span className="field-help">This changes the preselected currency for new invoices. Existing invoices keep their saved currency.</span></div>
          </div>
          <div className="form-actions"><SubmitButton pendingLabel="Saving profile…">Save business profile</SubmitButton></div>
        </form>
      </section>
      <section className="card detail-card settings-account-card"><h2 className="card-title">Signed-in account</h2><div className="detail-block"><div className="detail-label">Work email</div><div className="detail-value">{email || "Not available"}</div></div><p className="field-help">Change password through the password reset flow. Payment and AI provider credentials stay in server-side environment variables and are never shown here.</p></section>
    </main>
  );
}
