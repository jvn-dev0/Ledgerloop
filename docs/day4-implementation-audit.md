# LedgerLoop Day 4 Release Audit

**Reviewed:** 12 November 2026
**Branch:** `codex/add-ledgerloop-readme`
**Repository:** [jvn-dev0/Ledgerloop](https://github.com/jvn-dev0/Ledgerloop)

This audit records what is present in the checked-out source and what still needs a hosted environment or owner input. A route, migration, or integration in source is not evidence that its hosted workflow has passed.

## Project and stack

- The project uses the Next.js App Router. Current package ranges resolve to Next.js `16.4.5`, React `19.3.1`, TypeScript `6.0.3`, Tailwind CSS `4.3.5`, and Supabase JS `2.119.0`.
- `app/` contains authentication, setup, dashboard, customer, invoice, payment, assistant, and public payment-link routes. API routes cover the collections agent, policy documents, customer search, and PayPal operations.
- `components/` contains workspace navigation, invoice and customer forms, dashboard summaries, payment controls, status, pagination, and feedback UI. `lib/` contains business-scoped Supabase access, finance helpers, PayPal, the agent, and RAG/document ingestion.
- `supabase/migrations/` has Day 1–4 schema migrations. `tests/` has unit tests for finance, agent, RAG, and bounded request-body handling.
- `ui-ux-pro-max-cli@2.15.0` is installed globally. Its Codex skill files are present under `.agents/skills/`.
- `.env.local` is ignored by Git. This report contains no credential values.

## Implemented in source

- Supabase Auth pages include sign-in, sign-up, password recovery, password update, and a PKCE callback.
- The authenticated workspace includes dashboard, customer, invoice, payment, and collections-assistant pages. Customer and invoice create/edit/detail routes are present.
- Invoice and payment lists have status filters and pagination. Invoice history can also sort by issue date, due date, and invoice number. The workspace has responsive navigation and record layouts.
- App Router `not-found`, route error, and global error boundaries are present.
- Day 1–3 migrations define business-scoped records and RLS, invoice/payment constraints, PayPal reconciliation support, agent approvals, and policy-document storage.
- PayPal code includes server-side order creation/capture/cancel, webhook signature verification, and persisted payment reconciliation. The assistant uses business-scoped records and policy retrieval.
- A Day 4 migration adds business-scoped customer receivables/payment/activity functions and atomic per-user API rate limits. Customer detail and the dashboard now render these persisted summaries, pending approvals, and oldest-overdue invoices.
- The interface has been rethemed with forest, warm ivory, muted emerald/teal, amber, and coral tokens. See [day4-design-system.md](day4-design-system.md).

## Local verification evidence

This revision passed `npm run lint`, `npm run typecheck`, `npm test` (35/35), and `npm run build`. The first build attempt was blocked with a sandbox `EPERM` while creating generated output; the same build passed when granted workspace write access. These checks establish local compilation and unit-level behavior only; they do not prove hosted database, Auth, AI-provider, or payment flows.

A new loopback request from the current restricted environment was blocked by its socket permissions, so it did not establish whether the local server is currently reachable. Do not interpret that environment restriction as an application error.

## Hosted service checks

A read-only PostgREST probe was made against the configured Supabase project. The Auth health endpoint returned HTTP 200. Each of the following expected public tables returned HTTP 404 with `PGRST205` (table not found in the API schema cache):

`businesses`, `customers`, `invoices`, `payment_attempts`, `invoice_payment_links`, `paypal_webhook_events`, `knowledge_documents`, `knowledge_chunks`, `agent_conversations`, `agent_messages`, `agent_activity`, and `approval_requests`.

The checked-out repository contains four ordered SQL migrations under `supabase/migrations/`, but this environment has no database URL/password or Supabase access token configured to apply them. Until they are run in Supabase SQL Editor and the schema is visible through PostgREST, database-backed customer, invoice, dashboard, agent, and payment workflows remain blocked in the hosted project.

## Remaining release gaps

- **Hosted schema:** Apply all four repository migrations in date order, then confirm the expected tables and RPCs are available. This is the primary end-to-end blocker.
- **Auth lifecycle:** The Auth endpoint responds, but registration, confirmation, sign-in, sign-out, reset, and business creation have not been verified with a real test account.
- **Signup diagnostics:** The local server log records Supabase Auth codes `over_email_send_rate_limit` and `email_address_invalid`. Signup now gives safe, actionable messages for these two cases while keeping other errors generic. The rate-limited flow should be retried only after checking the inbox/spam folder and allowing the provider limit to reset.
- **Payments:** The PayPal routes are implemented, but the current environment does not have a PayPal client secret, and no sandbox capture/webhook lifecycle has been exercised.
- **AI provider:** The agent and RAG code exist, but no live provider request or hosted vector query was verified. A Groq credential was previously pasted into chat; rotate it in the provider console before using it again.
- **Rate-limit verification:** Atomic per-user limits are implemented in the Day 4 migration (8 agent requests and 3 uploads per 60-second window) and enforced by both API routes. Hosted behavior is unverified until the migration is applied.
- **Request bounds:** The agent route now reads at most 8 KiB before JSON parsing. The document route reads at most the 10 MiB file allowance plus 128 KiB multipart overhead before parsing form data, and still enforces the file-level limit.
- **Operations UI:** Customer detail now summarizes balances by currency and shows recent payment attempts and saved collection activity. Payment attempts are persisted, but there is no dedicated reconciliation view. The invoice list has status filtering, pagination, and user-selectable date/number sorting.
- **Product pages:** There is a setup guide but no business settings, privacy, or terms routes. No legal or business identity should be invented to fill these pages.
- **License:** The repository has no `LICENSE` file. The README badge and license section now say the license is not set; the owner should choose the terms before distribution. No copyright holder or legal text was invented.
- **Integration coverage:** The current tests are unit tests. There is no browser suite covering Auth, tenant isolation against hosted Supabase, or the PayPal capture/webhook lifecycle.

## UI library evaluation

No UI library was added during this audit. The application already uses Tailwind 4 and native, project-owned components, and adding a component framework would expand scope without fixing the hosted-schema blocker.

| Library | Official installation model and fit | Decision |
| --- | --- | --- |
| [Unlumen UI](https://unlumen-ui-docs.vercel.app/docs/installation) | shadcn registry source copied into the application; no required runtime bundle. Pro items require a license. The repo does not currently use shadcn. | Evaluate individual source components only if a concrete workflow needs them. |
| [Magic UI](https://magicui.design/docs) | Copy/paste components distributed through a shadcn registry. Many examples are animated and aimed at marketing/landing pages; motion dependencies vary by component. | Do not add decorative motion to the finance workspace. Use a component only when its interaction solves a product need. |
| [SmoothUI](https://smoothui.dev/docs/guides/getting-started) | Source components built for React 19, Tailwind 4, and shadcn; components may add Motion dependencies. | Compatible in principle, but not needed by the current product flows. |
| [Retro UI](https://retroui.io/installation) | Installable `pixel-retroui` package with a pixel/retro visual system and its own stylesheet. | Reject for the financial workspace visual direction and current UI; no package was installed. |

## Immediate next steps

1. Apply the four migrations in Supabase SQL Editor and confirm PostgREST can see the schema and Day 4 reporting/rate-limit functions.
2. Keep testing against real, owner-scoped data; verify the Auth lifecycle and customer/invoice CRUD before using dashboard results as a demo.
3. Exercise the Day 4 per-user rate limits against the hosted database and add a dedicated payment reconciliation view backed only by persisted attempts.
4. Test customer balances/history, invoice sorting, and dashboard queues against real business data.
5. Complete real PayPal Sandbox and AI-provider checks after the database is available and credentials have been rotated/configured.
6. Add integration/browser coverage for tenant isolation and the payment lifecycle, then update this audit with captured outcomes.

## Scope and limitations

This is a source and configuration audit with a read-only hosted schema probe. It does not certify production security, legal compliance, or external payment/provider behavior. No fake customer, invoice, or payment data was added.
