import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "A draft summary of LedgerLoop's product purpose and use limitations.",
};

export default function TermsPage() {
  return <LegalDocument
    title="Terms of service"
    intro="This implementation draft describes the current LedgerLoop product. It is not a complete contract; the operator must identify the contracting entity, support route, and applicable law with qualified counsel before public use."
    sections={[
      {
        title: "Product purpose",
        paragraphs: ["LedgerLoop provides business workspaces for organizing customer records, invoices, receivables, policy documents, collection activity, and payment references. It is an operational tool, not accounting, tax, legal, debt-collection, lending, or investment advice, and it does not guarantee that an invoice will be paid."],
      },
      {
        title: "Accounts and responsibilities",
        paragraphs: ["Users are responsible for providing accurate account and business information, keeping sign-in credentials secure, and using the workspace only for a business they are authorized to represent."],
        points: ["You are responsible for the accuracy and lawful use of customer, invoice, payment, and policy information you add, including having an appropriate basis to collect and use personal information.", "You must review records and payment status against your own accounting and provider records before making financial or customer-facing decisions.", "The operator must configure authentication email delivery, redirect URLs, database policies, backups, and provider credentials for the deployment."],
      },
      {
        title: "Acceptable use",
        paragraphs: ["Do not use LedgerLoop to violate applicable law, access another business's records, upload content you are not authorized to use, interfere with the service, or send unlawful, deceptive, harassing, or abusive collection communications."],
      },
      {
        title: "Payments and refunds",
        paragraphs: ["Where enabled, customer checkout is provided through PayPal. LedgerLoop records payment references and reconciliation status; it does not hold customer card or bank details or control PayPal's settlement, disputes, chargebacks, or refund decisions. The business that issued the invoice is responsible for resolving billing questions and arranging any refund through its payment provider. No LedgerLoop subscription fee or refund program is defined in the current application."],
      },
      {
        title: "Assistant and approvals",
        paragraphs: ["The collections assistant uses a language model and business records to produce explanations, analyses, and draft actions. Model output may be incomplete or incorrect and is not a verified financial fact unless it is supported by the displayed application record."],
        points: ["Check amounts, dates, customer details, policy excerpts, and recommendations before relying on them.", "A user with the required workspace access must review and approve proposed actions. Do not treat a draft or recommendation as sent or completed unless LedgerLoop displays a persisted result for that action."],
      },
      {
        title: "Availability and termination",
        paragraphs: ["The current project has no published service-level commitment, support contact, data export workflow, or self-service termination and deletion flow. The operator must define availability, support, suspension, termination, export, and deletion terms for the deployed service before public launch."],
      },
      {
        title: "Operator, support, and applicable law",
        paragraphs: ["The legal service provider, monitored support contact, and governing jurisdiction are not configured in the repository. These items must be completed for the intended market, including review of applicable consumer and privacy rules, before these terms are published."],
      },
    ]}
  />;
}
