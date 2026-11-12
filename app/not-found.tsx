import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" tabIndex={-1} className="error-screen">
      <div className="error-mark" aria-hidden="true">404</div>
      <p className="eyebrow">Page not found</p>
      <h1>We couldn’t find that record.</h1>
      <p>The link may be out of date, or the record may not belong to this workspace.</p>
      <div className="error-actions"><Link className="button" href="/">Return to LedgerLoop</Link><Link className="button secondary" href="/login">Sign in</Link></div>
    </main>
  );
}
