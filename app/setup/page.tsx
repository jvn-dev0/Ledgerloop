import Link from "next/link";
import { hasSupabaseConfig } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const configured = hasSupabaseConfig();

  return (
    <main className="auth-wrap">
      <section className="auth-visual">
        <Link className="brand" href="/"><span className="brand-mark">L</span>LedgerLoop</Link>
        <div className="auth-copy"><h1>Start with a reliable ledger.</h1><p>Connect your Supabase project to enable secure accounts, customer records, and invoice data.</p></div>
        <div className="auth-foot">LedgerLoop · Complete Financial Operations</div>
      </section>
      <section className="auth-panel">
        <div className="auth-box">
          <p className="eyebrow">Project setup</p>
          <h2>{configured ? "Business setup needed" : "Connect Supabase"}</h2>
          <p>{reason === "business" ? "Your account is signed in, but its business record could not be loaded. Apply the migration and check the account." : "LedgerLoop does not use demo records. Configure a Supabase project to continue."}</p>
          <div className="setup-steps">
            <div className="setup-step"><b>1</b><span>Create a Supabase project and copy its Project URL and publishable key.</span></div>
            <div className="setup-step"><b>2</b><span>Add both values to a local <code>.env.local</code> file using this template.</span></div>
          </div>
          <pre className="setup-code">NEXT_PUBLIC_SUPABASE_URL=&#10;NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=</pre>
          <div className="setup-steps">
            <div className="setup-step"><b>3</b><span>Run <code>supabase/migrations/20261109000100_initial_schema.sql</code> in the Supabase SQL Editor.</span></div>
            <div className="setup-step"><b>4</b><span>Restart the dev server, create an account, and confirm it through your email if required.</span></div>
          </div>
          {configured && <p className="auth-switch"><Link href="/login">Go to sign in</Link></p>}
        </div>
      </section>
    </main>
  );
}
