import Link from "next/link";
import type { ReactNode } from "react";
import { LegalLinks } from "@/components/legal/legal-links";

export type LegalSection = {
  title: string;
  paragraphs?: string[];
  points?: string[];
  content?: ReactNode;
};

export function LegalDocument({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <main id="main-content" tabIndex={-1} className="legal-page">
      <header className="legal-header">
        <Link className="brand legal-brand" href="/login"><span className="brand-mark">L</span>LedgerLoop</Link>
        <LegalLinks />
      </header>
      <article className="legal-document">
        <div className="legal-draft-notice" role="note">
          <strong>Working draft — owner and legal review required</strong>
          <span>These pages describe the current application code. They are not legal advice or a statement of legal compliance. Complete the operator and jurisdiction details and review the deployed service before publishing.</span>
        </div>
        <p className="eyebrow">Product information · Updated 12 November 2026</p>
        <h1>{title}</h1>
        <p className="legal-intro">{intro}</p>
        {sections.map((section) => (
          <section className="legal-section" key={section.title}>
            <h2>{section.title}</h2>
            {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {section.points && <ul>{section.points.map((point) => <li key={point}>{point}</li>)}</ul>}
            {section.content}
          </section>
        ))}
        <div className="legal-owner-todo">
          <h2>Before public launch</h2>
          <p>The LedgerLoop operator must add the responsible legal entity, a monitored privacy/support contact, the applicable jurisdiction, provider and retention details, and any required consent or data-rights process after reviewing the deployed configuration with qualified counsel.</p>
        </div>
        <footer className="legal-document-footer">
          <Link href="/login">Return to LedgerLoop</Link>
          <LegalLinks />
        </footer>
      </article>
    </main>
  );
}
