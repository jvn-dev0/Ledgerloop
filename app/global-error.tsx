"use client";

import { useEffect } from "react";

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("Application shell failed", { digest: error.digest ?? "unavailable" });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", background: "#f2f0e8", color: "#1d2c24", fontFamily: "Segoe UI, Arial, sans-serif" }}>
        <a href="#main-content" style={{ position: "absolute", left: 12, top: 12, padding: "10px 14px", borderRadius: 7, background: "#172b24", color: "#fbfaf5" }}>Skip to main content</a>
        <main id="main-content" tabIndex={-1} style={{ display: "grid", minHeight: "100vh", alignContent: "center", justifyItems: "start", gap: 16, maxWidth: 640, margin: "0 auto", padding: 32 }}>
          <span aria-hidden="true" style={{ display: "grid", width: 42, height: 42, placeItems: "center", borderRadius: 12, background: "#172b24", color: "#fbfaf5", fontWeight: 750 }}>L</span>
          <p style={{ margin: 0, color: "#536275", fontSize: 14 }}>LedgerLoop</p>
          <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.15 }}>LedgerLoop could not start.</h1>
          <p style={{ margin: 0, color: "#536275", lineHeight: 1.6 }}>Try loading the application again. If the issue continues, contact your workspace administrator.</p>
          <button type="button" onClick={() => retry()} style={{ minHeight: 44, padding: "0 16px", border: 0, borderRadius: 7, background: "#28684f", color: "#fbfaf5", cursor: "pointer", font: "inherit", fontWeight: 650 }}>Try again</button>
        </main>
      </body>
    </html>
  );
}
