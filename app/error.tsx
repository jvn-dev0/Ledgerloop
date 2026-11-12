"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorBoundary({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("Route rendering failed", { digest: error.digest ?? "unavailable" });
  }, [error]);

  return (
    <main className="error-screen" role="alert">
      <div className="error-mark" aria-hidden="true">L</div>
      <p className="eyebrow">LedgerLoop workspace</p>
      <h1>This page could not load.</h1>
      <p>Try again. If the problem continues, return to your dashboard and retry from there.</p>
      {error.digest && <p className="error-reference">Reference: {error.digest}</p>}
      <div className="error-actions"><button className="button" type="button" onClick={() => retry()}>Try again</button><Link className="button secondary" href="/">Return to LedgerLoop</Link></div>
    </main>
  );
}
