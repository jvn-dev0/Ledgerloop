import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: "A draft description of the information LedgerLoop processes.",
};

export default function PrivacyPage() {
  return <LegalDocument
    title="Privacy notice"
    intro="This draft explains what the current LedgerLoop application is designed to process when a business uses its workspace, collections assistant, policy library, and PayPal checkout."
    sections={[
      {
        title: "Who operates LedgerLoop",
        paragraphs: ["The legal operator of LedgerLoop has not yet been identified in this application. The owner must publish the verified entity name and a monitored privacy contact before inviting customers or using the service with real personal information."],
      },
      {
        title: "Information in a workspace",
        paragraphs: ["An account can include a business name and the email address used with Supabase Auth. A workspace can store customer names, company and contact details, invoice numbers, issue and due dates, amounts, currencies, invoice status, and notes or activity associated with collections."],
        points: ["Payment records include provider order and capture references, amounts, currencies, statuses, and timestamps needed to show payment and reconciliation state. LedgerLoop's checkout is designed to leave card and bank details with PayPal.", "The policy library accepts text, Markdown, and PDF documents. Extracted text and locally generated search embeddings are stored with the business's knowledge records.", "The collections assistant stores conversation messages, generated answers, selected tool activity, and limited execution metadata in the workspace database."],
      },
      {
        title: "How information is used and shared",
        paragraphs: ["Workspace information is used to authenticate users, display and update customer and invoice records, calculate receivables, maintain payment records, retrieve uploaded policy content, and protect the service from excessive API requests."],
        points: ["When the collections assistant is used, the user's request, recent conversation history, and relevant business context or retrieved policy excerpts may be sent from the server to Groq for model processing. The assistant can receive selected customer, invoice, and payment facts through its tools. Avoid entering information that is not needed for the request.", "Policy document embeddings are generated in the application environment using the configured local embedding model; search vectors and document content are persisted in Supabase. Retrieved excerpts may later be included in an assistant request to Groq.", "When a business enables customer checkout, the browser loads PayPal's checkout SDK and payment processing is handled by PayPal. LedgerLoop records references and resulting payment state, not card or bank credentials. PayPal's own terms and privacy notices apply to its service."],
      },
      {
        title: "Storage, access, and retention",
        paragraphs: ["The application is designed to scope records to a business and use Supabase authentication and row-level access controls. The hosted database must have the repository migrations applied and its access policies verified before this design can be relied on in a deployed environment."],
        points: ["Retention periods depend on the deployed database, backup, and provider configuration and have not been set in this draft. The operator must document and implement a retention and deletion schedule before public launch.", "There is no self-service account or workspace deletion flow in the current interface. Do not treat deletion as complete until the operator defines and carries out a verified request process."],
      },
      {
        title: "Email and marketing",
        paragraphs: ["Supabase Auth may send account confirmation or password recovery messages when those flows are enabled. The current application has no marketing email feature. Configure the sender, redirect URLs, and support contact in the deployed service before relying on account messages."],
      },
      {
        title: "Your choices and questions",
        paragraphs: ["A privacy contact and jurisdiction-specific process for access, correction, export, objection, or deletion requests have not been configured. The operator must add a monitored contact and confirm which rights and response periods apply to the intended users and markets."],
      },
    ]}
  />;
}
