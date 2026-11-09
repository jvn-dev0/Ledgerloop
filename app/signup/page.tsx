import Link from "next/link";
import { signUp } from "@/app/actions/auth";
import { hasSupabaseConfig } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const configured = hasSupabaseConfig();
  return (
    <main className="auth-wrap">
      <section className="auth-visual">
        <Link className="brand" href="/"><span className="brand-mark">L</span>LedgerLoop</Link>
        <div className="auth-copy"><h1>Make receivables easier to manage.</h1><p>Create your business workspace and start with a clear record of customers and invoices.</p><div className="auth-highlight"><span>Private business data</span><span>Real records, no demo numbers</span></div></div>
        <div className="auth-foot">LedgerLoop · Complete Financial Operations</div>
      </section>
      <section className="auth-panel">
        <div className="auth-box">
          <p className="eyebrow">Get started</p><h2>Create your account</h2><p>Your business workspace is created securely when you sign up.</p>
          {error && <div className="alert" role="alert">{error}</div>}
          {!configured && <div className="alert">Supabase is not configured. <Link href="/setup">Open setup</Link>.</div>}
          <form action={signUp} className="auth-form">
            <div className="field"><label htmlFor="business_name">Business name</label><input className="input" id="business_name" name="business_name" autoComplete="organization" maxLength={120} required /></div>
            <div className="field"><label htmlFor="email">Work email</label><input className="input" id="email" name="email" type="email" autoComplete="email" required /></div>
            <div className="field"><label htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required /><span className="field-help">Use at least 8 characters.</span></div>
            <button className="button" type="submit" disabled={!configured}>Create account <span aria-hidden="true">→</span></button>
          </form>
          <div className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></div>
        </div>
      </section>
    </main>
  );
}
