import Link from "next/link";
import { signIn } from "@/app/actions/auth";
import { hasSupabaseConfig } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { error, notice } = await searchParams;
  const configured = hasSupabaseConfig();
  return (
    <main className="auth-wrap">
      <section className="auth-visual">
        <Link className="brand" href="/"><span className="brand-mark">L</span>LedgerLoop</Link>
        <div className="auth-copy"><h1>Know what’s owed. Keep business moving.</h1><p>Bring customer records and invoice follow-up into one clear financial workspace.</p><div className="auth-highlight"><span>Receivables at a glance</span><span>Verified payment records</span></div></div>
        <div className="auth-foot">LedgerLoop · Complete Financial Operations</div>
      </section>
      <section className="auth-panel">
        <div className="auth-box">
          <p className="eyebrow">Welcome back</p><h2>Sign in to LedgerLoop</h2><p>Use your business account to manage customers and invoices.</p>
          {error && <div className="alert" role="alert">{error}</div>}
          {notice && <div className="notice" role="status">{notice}</div>}
          {!configured && <div className="alert">Supabase is not configured. <Link href="/setup">Open setup</Link>.</div>}
          <form action={signIn} className="auth-form">
            <div className="field"><label htmlFor="email">Work email</label><input className="input" id="email" name="email" type="email" autoComplete="email" required /></div>
            <div className="field"><label htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" autoComplete="current-password" minLength={8} required /></div>
            <button className="button" type="submit" disabled={!configured}>Sign in <span aria-hidden="true">→</span></button>
          </form>
          <div className="auth-switch">New to LedgerLoop? <Link href="/signup">Create an account</Link></div>
        </div>
      </section>
    </main>
  );
}
