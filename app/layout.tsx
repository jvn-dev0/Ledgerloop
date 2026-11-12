import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "LedgerLoop — Financial Operations", template: "%s · LedgerLoop" },
  description: "Track customer invoices and receivables in LedgerLoop.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to main content</a>{children}</body></html>;
}
