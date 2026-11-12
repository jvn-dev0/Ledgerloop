import Link from "next/link";
import { signUp } from "@/app/actions/auth";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { LegalLinks } from "@/components/legal/legal-links";
import { hasSupabaseConfig } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const configured = hasSupabaseConfig();
  return (
    <main id="main-content" tabIndex={-1} className="auth-wrap">
      <section className="auth-visual">
        <Link className="brand" href="/"><span className="brand-mark">L</span>LedgerLoop</Link>
        <div className="auth-copy">
          <p className="auth-kicker">Complete Financial Operations</p>
          <h1>Start with a clear view of what is owed.</h1>
          <p>Create a business workspace for the customers, invoices, and payments you manage.</p>
          <ul className="auth-benefits">
            <li><span className="auth-benefit-index">01</span><span><strong>Your business workspace</strong><small>Records are scoped to your signed-in business.</small></span></li>
            <li><span className="auth-benefit-index">02</span><span><strong>Customer and invoice records</strong><small>Keep contact and billing details together.</small></span></li>
            <li><span className="auth-benefit-index">03</span><span><strong>Receivables at a glance</strong><small>Review totals without sample transactions.</small></span></li>
          </ul>
        </div>
        <div className="auth-foot">LedgerLoop · Complete Financial Operations</div>
      </section>
      <section className="auth-panel">
        <div className="auth-box">
          <p className="eyebrow auth-eyebrow">Get started</p><h2>Create your account</h2><p className="auth-description">Your business workspace is created securely when you sign up.</p>
          {error && <div className="alert" role="alert">{error}</div>}
          {!configured && <div className="alert">Supabase is not configured. <Link href="/setup">Open setup</Link>.</div>}
          <form action={signUp} className="auth-form">
            <div className="field"><label htmlFor="business_name">Business name</label><input className="input" id="business_name" name="business_name" autoComplete="organization" maxLength={120} required /></div>
            <div className="field"><label htmlFor="email">Work email</label><input className="input" id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required /></div>
            <div className="field"><label htmlFor="password">Password</label><PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} required /><span className="field-help">Use at least 8 characters.</span></div>
            <SubmitButton pendingLabel="Creating account…" disabled={!configured}>Create account <span aria-hidden="true">→</span></SubmitButton>
          </form>
          <div className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></div>
        </div>
      </section>
      <LegalLinks className="auth-legal-links" />
    </main>
  );
}
