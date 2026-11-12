import Link from "next/link";
import { updatePassword } from "@/app/actions/auth";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const configured = hasSupabaseConfig();
  let recoverySession = false;
  if (configured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    recoverySession = Boolean(data?.claims?.sub);
  }

  return (
    <main id="main-content" tabIndex={-1} className="auth-wrap">
      <section className="auth-visual">
        <Link className="brand" href="/login"><span className="brand-mark">L</span>LedgerLoop</Link>
        <div className="auth-copy">
          <p className="auth-kicker">Account access</p>
          <h1>Choose a new password.</h1>
          <p>Use a password manager to create and save a unique password for this workspace.</p>
        </div>
        <div className="auth-foot">LedgerLoop · Complete Financial Operations</div>
      </section>
      <section className="auth-panel">
        <div className="auth-box">
          <p className="eyebrow auth-eyebrow">Password recovery</p>
          <h2>Set a new password</h2>
          {error && <div className="alert" role="alert">{error}</div>}
          {!configured && <div className="alert" role="alert">Supabase is not configured. <Link href="/setup">Open setup</Link>.</div>}
          {configured && recoverySession ? <>
            <p className="auth-description">Use at least 8 characters. You’ll sign in again after the password is updated.</p>
            <form action={updatePassword} className="auth-form">
              <div className="field"><label htmlFor="password">New password</label><PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} maxLength={128} required /></div>
              <div className="field"><label htmlFor="confirm_password">Confirm new password</label><PasswordInput id="confirm_password" name="confirm_password" autoComplete="new-password" minLength={8} maxLength={128} required /></div>
              <SubmitButton pendingLabel="Updating password…">Update password</SubmitButton>
            </form>
          </> : configured ? <>
            <p className="auth-description">Open the latest reset email to continue. If the link expired, request a new one.</p>
            <div className="auth-switch"><Link href="/forgot-password">Request another reset email</Link></div>
          </> : null}
          <div className="auth-switch"><Link href="/login">Return to sign in</Link></div>
        </div>
      </section>
    </main>
  );
}
