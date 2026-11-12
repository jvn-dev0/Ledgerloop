import Link from "next/link";

export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <nav className={`legal-links ${className}`.trim()} aria-label="Legal information">
      <Link href="/privacy">Privacy</Link>
      <Link href="/terms">Terms</Link>
      <Link href="/cookies">Cookies</Link>
    </nav>
  );
}
