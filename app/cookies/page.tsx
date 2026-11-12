import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";

export const metadata: Metadata = {
  title: "Cookie information",
  description: "A draft description of session and checkout technologies used by LedgerLoop.",
};

export default function CookiesPage() {
  return <LegalDocument
    title="Cookie information"
    intro="This draft reflects the authentication and checkout integrations found in the current source. Browser behavior can differ by deployment, domain, and provider configuration, so verify it on the deployed site before publication."
    sections={[
      {
        title: "Essential authentication cookies",
        paragraphs: ["LedgerLoop uses Supabase's server-side authentication integration, which reads and refreshes session cookies so signed-in users can reach protected workspace pages. These cookies support sign-in and session security. Their names, lifetimes, and security attributes depend on the deployed Supabase configuration and should be checked in the production browser."],
      },
      {
        title: "PayPal checkout",
        paragraphs: ["A public invoice checkout loads PayPal's JavaScript SDK when the business has configured PayPal. PayPal may use cookies or similar storage for its checkout, fraud prevention, and account features. Those technologies are controlled by PayPal and subject to its current notices and settings."],
      },
      {
        title: "Analytics and choices",
        paragraphs: ["No analytics or advertising tags were found in the repository during this review. The application does not currently offer a cookie-preference control. The operator should recheck the deployed site, PayPal behavior, and rules in each intended market. If any non-essential technology requires consent, add a consent interface before enabling it; do not infer that this draft is consent or legal approval."],
      },
    ]}
  />;
}
