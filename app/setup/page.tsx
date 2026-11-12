import Link from "next/link";
import { hasSupabaseConfig } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const configured = hasSupabaseConfig();
  const heading = reason === "business" ? "Finish business setup" : configured ? "Install the database schema" : "Connect Supabase";
  const message = reason === "business"
    ? "Your account is signed in, but its business workspace is missing. Apply the Day 1 schema and existing-account migration below, then sign out and sign in again."
    : configured
      ? "Supabase is configured, but LedgerLoop’s tables are not available yet. Apply the Day 1 schema in your project’s SQL Editor."
      : "LedgerLoop does not use demo records. Configure a Supabase project to continue.";

  return (
    <main id="main-content" tabIndex={-1} className="auth-wrap">
      <section className="auth-visual">
        <Link className="brand" href="/"><span className="brand-mark">L</span>LedgerLoop</Link>
        <div className="auth-copy"><h1>Start with a reliable ledger.</h1><p>Connect your Supabase project to enable secure accounts, customer records, and invoice data.</p></div>
        <div className="auth-foot">LedgerLoop · Complete Financial Operations</div>
      </section>
      <section className="auth-panel">
        <div className="auth-box">
          <p className="eyebrow">Project setup</p>
          <h2>{heading}</h2>
          <p>{message}</p>
          {!configured && <><div className="setup-steps">
            <div className="setup-step"><b>1</b><span>Create a Supabase project and copy its Project URL and publishable key.</span></div>
            <div className="setup-step"><b>2</b><span>Add both values to a local <code>.env.local</code> file using this template.</span></div>
          </div>
          <pre className="setup-code">NEXT_PUBLIC_SUPABASE_URL=&#10;NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=</pre></>}
          <div className="setup-steps">
            <div className="setup-step"><b>{configured ? "1" : "3"}</b><span>Run <code>supabase/migrations/20261109000100_initial_schema.sql</code> in the Supabase SQL Editor.</span></div>
            <div className="setup-step"><b>{configured ? "2" : "4"}</b><span>Run <code>supabase/migrations/20261109000200_backfill_existing_businesses.sql</code> to create workspaces for accounts that existed before the schema.</span></div>
            <div className="setup-step"><b>{configured ? "3" : "5"}</b><span>Refresh this page. If your workspace still does not load, sign out and sign in again. New accounts receive a workspace automatically.</span></div>
          </div>
          {configured && <p className="auth-switch">For PayPal, collections, and reporting features, apply the Day 2–4 migration files in filename order. Enable the <code>vector</code> extension before applying the Day 3 migration.</p>}
        </div>
      </section>
    </main>
  );
}
