import Link from "next/link";
import { signIn } from "@/app/actions/auth";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { LegalLinks } from "@/components/legal/legal-links";
import { hasSupabaseConfig } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { error, notice } = await searchParams;
  const configured = hasSupabaseConfig();
  return (
    <main id="main-content" tabIndex={-1} className="auth-wrap">
      <section className="auth-visual">
        <Link className="brand" href="/"><span className="brand-mark">L</span>LedgerLoop</Link>
        <div className="auth-copy">
          <p className="auth-kicker">Complete Financial Operations</p>
          <h1>Financial work, kept in order.</h1>
          <p>Know which invoices need attention and keep the customer context close at hand.</p>
          <ul className="auth-benefits">
            <li><span className="auth-benefit-index">01</span><span><strong>Customer records</strong><small>Contact details stay connected to invoices.</small></span></li>
            <li><span className="auth-benefit-index">02</span><span><strong>Invoice status</strong><small>See what is due and what is overdue.</small></span></li>
            <li><span className="auth-benefit-index">03</span><span><strong>Verified payments</strong><small>Confirmed captures update payment records.</small></span></li>
          </ul>
        </div>
        <div className="auth-foot">LedgerLoop · Complete Financial Operations</div>
      </section>
      <section className="auth-panel">
        <div className="auth-box">
          <p className="eyebrow auth-eyebrow">Welcome back</p><h2>Sign in</h2><p className="auth-description">Use your business account to manage customers, invoices, and receivables.</p>
          {error && <div className="alert" role="alert">{error}</div>}
          {notice && <div className="notice" role="status">{notice}</div>}
          {!configured && <div className="alert">Supabase is not configured. <Link href="/setup">Open setup</Link>.</div>}
          <form action={signIn} className="auth-form">
            <div className="field"><label htmlFor="email">Work email</label><input className="input" id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required /></div>
            <div className="field"><label htmlFor="password">Password</label><PasswordInput id="password" name="password" autoComplete="current-password" minLength={8} required /></div>
            <div className="auth-recovery"><Link href="/forgot-password">Forgot password?</Link></div>
            <SubmitButton pendingLabel="Signing in…" disabled={!configured}>Sign in <span aria-hidden="true">→</span></SubmitButton>
          </form>
          <div className="auth-switch">New to LedgerLoop? <Link href="/signup">Create an account</Link></div>
        </div>
      </section>
      <LegalLinks className="auth-legal-links" />
    </main>
  );
}
