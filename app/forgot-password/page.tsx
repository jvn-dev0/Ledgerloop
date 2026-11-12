import Link from "next/link";
import { requestPasswordReset } from "@/app/actions/auth";
import { SubmitButton } from "@/components/ui/submit-button";
import { hasSupabaseConfig } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const [{ error, notice }, configured] = await Promise.all([searchParams, Promise.resolve(hasSupabaseConfig())]);
  return (
    <main id="main-content" tabIndex={-1} className="auth-wrap">
      <section className="auth-visual">
        <Link className="brand" href="/login"><span className="brand-mark">L</span>LedgerLoop</Link>
        <div className="auth-copy">
          <p className="auth-kicker">Account access</p>
          <h1>Get back to your receivables.</h1>
          <p>Request a secure password reset link for your business account.</p>
        </div>
        <div className="auth-foot">LedgerLoop · Complete Financial Operations</div>
      </section>
      <section className="auth-panel">
        <div className="auth-box">
          <p className="eyebrow auth-eyebrow">Password recovery</p>
          <h2>Reset your password</h2>
          <p className="auth-description">Enter your work email. If it belongs to an account, we’ll send a reset link.</p>
          {error && <div className="alert" role="alert">{error}</div>}
          {notice && <div className="notice" role="status">{notice}</div>}
          {!configured && <div className="alert" role="alert">Supabase is not configured. <Link href="/setup">Open setup</Link>.</div>}
          <form action={requestPasswordReset} className="auth-form">
            <div className="field"><label htmlFor="email">Work email</label><input className="input" id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required /></div>
            <SubmitButton pendingLabel="Sending reset email…" disabled={!configured}>Send reset email</SubmitButton>
          </form>
          <div className="auth-switch"><Link href="/login">Return to sign in</Link></div>
        </div>
      </section>
    </main>
  );
}
