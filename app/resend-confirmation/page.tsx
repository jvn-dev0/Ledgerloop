import Link from "next/link";
import { resendSignupConfirmation } from "@/app/actions/auth";
import { LegalLinks } from "@/components/legal/legal-links";
import { SubmitButton } from "@/components/ui/submit-button";
import { hasSupabaseConfig } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function ResendConfirmationPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { error, notice } = await searchParams;
  const configured = hasSupabaseConfig();

  return (
    <main id="main-content" tabIndex={-1} className="auth-wrap">
      <section className="auth-visual">
        <Link className="brand" href="/login"><span className="brand-mark">L</span>LedgerLoop</Link>
        <div className="auth-copy">
          <p className="auth-kicker">Account access</p>
          <h1>Confirm your email to continue.</h1>
          <p>Confirmation links expire. Request another one if your signup email did not arrive or the link is no longer valid.</p>
        </div>
        <div className="auth-foot">LedgerLoop · Complete Financial Operations</div>
      </section>
      <section className="auth-panel">
        <div className="auth-box">
          <p className="eyebrow auth-eyebrow">Email confirmation</p>
          <h2>Resend confirmation</h2>
          <p className="auth-description">Enter the email address you used to create your account. We’ll show the same result whether or not a confirmation is pending.</p>
          {error && <div className="alert" role="alert">{error}</div>}
          {notice && <div className="notice" role="status" aria-live="polite">{notice}</div>}
          {!configured && <div className="alert" role="alert">Supabase is not configured. <Link href="/setup">Open setup</Link>.</div>}
          <form action={resendSignupConfirmation} className="auth-form">
            <div className="field"><label htmlFor="email">Work email</label><input className="input" id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required /></div>
            <SubmitButton pendingLabel="Sending…" disabled={!configured}>Send confirmation link</SubmitButton>
          </form>
          <div className="auth-switch"><Link href="/login">Back to sign in</Link></div>
        </div>
      </section>
      <LegalLinks className="auth-legal-links" />
    </main>
  );
}
