 <div align="center">

<!-- HERO BANNER -->

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:172B24,50:28684F,100:D7B77A&height=200&section=header&text=LedgerLoop&fontSize=65&fontColor=FFFFFF&animation=fadeIn&fontAlignY=40&desc=Complete%20Financial%20Operations&descAlignY=65&descSize=20" width="100%" />

# LedgerLoop

### Complete Financial Operations

**From unpaid invoice to verified payment.**

An accounts receivable workspace for customer records, invoices, currency-aware receivables, verified PayPal payment processing, and AI-assisted collections with business-scoped policy retrieval.

<br/>

![Project Status](https://img.shields.io/badge/Status-In%20Development-2F7659?style=for-the-badge)
![Stack](https://img.shields.io/badge/Stack-Next.js%20%2B%20Supabase-172B24?style=for-the-badge)
![License](https://img.shields.io/badge/License-Not%20set-895B1D?style=for-the-badge)

<br/>

[Overview](#-overview) •
[Problem](#-the-problem) •
[Features](#-key-features) •
[Architecture](#-how-it-works) •
[Tech Stack](#-technology-stack) •
[Getting Started](#-getting-started) •
[Roadmap](#-roadmap) •
[Day 1 Update](README_DAY1.md) •
[Day 2 Update](README_DAY2.md) •
[Day 3 Update](README_DAY3.md) •
[Day 4 Update](README_DAY4.md) •
[Performance Notes](docs/performance-and-complexity.md) •
[Day 4 Release Report](docs/day4-release-report.md) •
[Three-Minute Demo Runbook](docs/day4-demo-script.md)

</div>

---

## 🌐 Overview

LedgerLoop is an intelligent financial operations platform designed for freelancers, small agencies, and service-based businesses.

Businesses often struggle with unpaid invoices, inconsistent payment follow-ups, scattered financial information, and manual payment reconciliation.

LedgerLoop brings these workflows together in one platform.

Day 1 supports authenticated customer and invoice management, with receivables summaries calculated from persisted invoice records. Day 2 adds secure PayPal checkout links, server-side order and capture handling, webhook verification, and payment reconciliation. Day 3 adds the **LedgerLoop Collections Agent**: a Groq-hosted Qwen tool-calling loop, deterministic collections scoring, local `Supabase/gte-small` embeddings, pgvector policy retrieval, reviewable reminder drafts, approval-gated PayPal payment-link creation, and tool activity history. Day 4 adds password recovery, accessible password visibility and submission feedback, application-level error pages, responsive customer/invoice/payment views, business name and default invoice currency settings, customer balances and histories, dashboard overdue and approval queues, invoice status filters and date/number sorting, payment reconciliation status against verified captures, bounded and rate-limited agent/document APIs, safer payment-state error handling, and a forest-and-ivory workspace palette.

Payment code uses real PayPal responses and persisted database records. Sandbox end-to-end verification requires the Day 2 migration and PayPal Sandbox credentials. The agent uses persisted business data and indexed policy documents; it does not generate demo financial records or simulate payment activity.

**Our goal:** Reduce manual accounts receivable work and make the journey from invoice creation to payment reconciliation simpler and more transparent.

## 📁 Project structure

```text
app/
  (workspace)/       Authenticated dashboard, customer, invoice, and payment pages
  actions/            Server actions for authentication, invoices, and payment links
  api/                Customer search, PayPal routes, agent chat, approval, and policy-document APIs
  pay/[token]/         Public invoice checkout page
  login/, signup/      Supabase Auth entry points
  auth/callback/       PKCE email confirmation and password-reset callback
  forgot-password/     Password recovery request
  reset-password/      Authenticated password update
  privacy/, terms/, cookies/  Product and cookie policy implementation drafts
  setup/               Supabase configuration and migration guidance
components/
  dashboard/           Receivables metrics and summary views
  invoices/            Customer picker, invoice forms, and payment-link controls
  layout/              Workspace navigation
  legal/               Shared legal page layout and links
  payments/            PayPal checkout button
  ui/                  Shared feedback, pagination, loading, and status components
lib/
  data/                Business-scoped database queries
  finance/             Decimal-safe money and date utilities
  agent/               Groq adapter, orchestration, typed tools, scoring, and telemetry
  rag/                 Document extraction, local embeddings, ingestion, and retrieval
  paypal/              Server-only PayPal API and checkout helpers
  supabase/            Server, admin, and request-scoped Supabase clients
  validations/         Server-side form validation
supabase/migrations/   PostgreSQL schema, RLS, indexes, and reconciliation functions
tests/                 Finance, agent, RAG, and bounded request-body unit tests
types/                 Database and domain types
README.md              Product overview and local setup
README_DAY1.md         Day 1 implementation and verification notes
README_DAY2.md         Day 2 payment implementation and setup notes
README_DAY3.md         Day 3 collections agent and RAG setup notes
README_DAY4.md         Day 4 reliability, recovery, and responsive UI notes
.agents/skills/        Project-local UI/UX Pro Max guidance for Codex
docs/                  Performance, release audit, and demo runbook
```

Local credentials belong in `.env.local`; generated dependencies and build/test output are excluded from Git by `.gitignore`.

The `/privacy`, `/terms`, and `/cookies` pages are visibly marked implementation drafts. They describe current source behavior and require the operator's identity, support contact, retention policy, jurisdiction, and qualified legal review before public use. LedgerLoop does not define or control merchant refunds, so the repository does not claim to offer refunds.

## 🚨 The Problem

Getting paid is not always as simple as sending an invoice.

Small businesses regularly deal with:

- Overdue invoices and delayed customer payments.
- Manually checking which customers still owe money.
- Forgetting or inconsistently sending payment reminders.
- Difficulty identifying which outstanding invoices need attention first.
- Disconnected payment records and invoice information.
- Manually checking whether a payment was actually completed.

These tasks consume time that business owners could spend serving customers and growing their businesses.

## 💡 Our Solution

LedgerLoop is built in milestones. Day 1 establishes customer and invoice management, database access controls, and receivables summaries. Day 2 adds PayPal payment processing. Day 3 adds an owner-scoped collections assistant with these capabilities. Day 4 improves account recovery, error handling, payment state checks, and responsive record browsing.

1. Retrieve invoice and customer information.
2. Identify overdue and outstanding invoices.
3. Calculate outstanding amounts and overdue durations.
4. Prioritise collection activities using transparent rules and available customer history.
5. Generate personalised payment reminder drafts.
6. Prepare PayPal payment checkout sessions.
7. Read the verified PayPal payment status stored for an invoice.

**Human approval remains part of important financial actions.** The agent assists with decisions and execution, while verified payment records remain the source of truth.

## ✨ Key Features

| Feature | Description |
|---|---|
| Customer management | Implemented with business-scoped Supabase queries and paginated lists. |
| Invoice management | Implemented with business-scoped forms, details, and paginated lists. |
| Receivables dashboard | PostgreSQL aggregation grouped by currency; requires migrations to be applied. |
| Business data isolation | Supabase Auth and row-level security policies are defined in the migrations. |
| Collections Agent | Day 3 code is implemented; it requires the Day 3 migration and a valid server-side Groq key. |
| PayPal checkout, capture, and webhooks | Day 2 code is implemented; Sandbox setup and end-to-end verification remain environment-dependent. |
| Account recovery and failure pages | Password reset uses Supabase Auth PKCE callbacks; route, global, and not-found pages provide recovery paths. Add the local callback URL to Supabase Auth's redirect allow-list. |
| Responsive receivables workspace | Customer, invoice, and payment records adapt to small screens; invoice and payment history can be filtered by status. |

## 🤖 The Collections Agent

The AI agent interacts with application data through typed, server-side tools. Groq's Qwen model proposes tool calls; the backend validates each request, scopes queries to the signed-in business, and returns persisted results to the model.

Example user instruction:

> Show me all overdue invoices and tell me which customers I should follow up with first.

The implemented agent workflow is:

```text
User Request
     |
     v
Collections Agent
     |
     v
Understand the Request
     |
     v
Call Backend Tools
     |
     +------> Retrieve Invoices
     |
     +------> Retrieve Customer History
     |
     +------> Calculate Outstanding Amounts
     |
     v
Analyse & Prioritise
     |
     v
Generate Recommendations
     |
     v
Request Human Approval
     |
     v
Execute Approved Action
     |
     v
Verify & Record Result
```

The workflow uses structured tools rather than generated financial values. The LLM cannot issue SQL, access another business, send email, or capture a payment.

**Important design principle:** AI can interpret, analyse, and recommend. The database and verified PayPal responses determine actual balances and payment status.

## 💳 PayPal Integration

The Day 2 PayPal integration creates private invoice payment links, sends order and capture requests from the server, verifies amounts and currency against stored invoice data, and reconciles successful captures. Webhook signatures are verified with PayPal and duplicate event IDs are recorded.

The PayPal Sandbox integration supports:

- Creating PayPal payment orders.
- Generating checkout experiences.
- Capturing approved payments through the backend.
- Verifying payment results.
- Processing payment webhooks.
- Updating invoice records after successful verification.

Payment status is never changed simply because a customer clicks a button. A database transaction marks an attempt captured and its invoice paid only after the server verifies PayPal's completed capture.

The database prevents an invoice from being marked paid unless a matching captured payment record exists. See [README_DAY2.md](README_DAY2.md) for configuration and current verification limits.

## 🏗️ Architecture

The web app, PayPal integration, and Day 3 collections workflow are implemented in the repository. Live finance workflows require the migrations to be applied to the connected Supabase project; the agent also requires a valid server-side Groq key. Day 4's account recovery flow also requires the application callback URL in Supabase's redirect allow-list.

```text
                  LEDGERLOOP
                       |
          +------------+------------+
          |                         |
          v                         v
     Web Application          Collections Agent
          |                         |
          |                    Groq Qwen 3.8
          |                         |
          |                   Tool Calling
          |                         |
          +------------+------------+
                       |
                       v
                Backend Services
                       |
          +------------+------------+
          |                         |
          v                         v
     PostgreSQL                 PayPal API
      Database                 Checkout
          |                         |
          |                         v
          |                   Payment Capture
          |                         |
          +------------+------------+
                       |
                       v
              Payment Verification
                       |
                       v
                 Reconciliation
```

## 🧰 Technology Stack

### Frontend

<p>
<img src="https://skillicons.dev/icons?i=nextjs,react,ts,tailwind" />
</p>

- Next.js 16.4.5 — App Router application framework.
- React 19.3.1 — User interface.
- TypeScript 6.0.3 — Type-safe application development.
- Tailwind CSS 4.3.5 — Responsive styling.

### Backend & Database

<p>
<img src="https://skillicons.dev/icons?i=nodejs,ts,supabase,postgres" />
</p>

- Node.js — Backend runtime.
- TypeScript — Backend logic and typed integrations.
- Supabase Auth and PostgreSQL — Authentication, database, and row-level security.
- PostgreSQL — Persistent business, invoice, and payment data.

### AI & Payment Infrastructure

<p><strong>Groq · Transformers.js · pgvector · PayPal</strong></p>

- Groq API (Qwen 3.8 27B) — Runtime language model and tool-call proposals; model availability and limits follow Groq account settings.
- `@huggingface/transformers` with `Supabase/gte-small` — Local, server-side 384-dimensional document embeddings.
- pgvector — Business-scoped semantic policy search in Supabase PostgreSQL.
- PayPal Developer Platform — Payment orders, checkout, and transaction processing.
- PayPal Sandbox — Payment integration and testing.
- Webhooks — Payment event processing and reconciliation.

### Development & Deployment

<p>
<img src="https://skillicons.dev/icons?i=git,github,vscode,vercel" />
</p>

- Git & GitHub — Version control and collaboration.
- VS Code — Development environment.
- Vercel — Planned application deployment.

The OpenAI API remains a possible later provider. PayPal Sandbox credentials and webhook configuration must be supplied locally.

## 🔐 Security & Reliability

Financial operations require accuracy and accountability.

LedgerLoop is designed around the following principles:

- Never trust AI-generated payment amounts or payment status as authoritative.
- Keep sensitive payment operations on the backend.
- Verify PayPal payment responses and webhook signatures.
- Use idempotency to prevent duplicate payment processing.
- Maintain audit logs for important financial actions.
- Require approval for sensitive agent actions.
- Keep API keys and credentials in environment variables.

## 🚀 Getting Started

### Prerequisites

- Node.js 20.9 or later and npm
- Git
- Supabase project (URL and publishable key)

### Installation

```bash
# Clone the repository
git clone https://github.com/jvn-dev0/Ledgerloop.git

# Navigate to the project
cd Ledgerloop

# Install dependencies
npm install

# Create environment configuration
cp .env.example .env.local
```

Apply migrations in order in the Supabase SQL Editor: Day 1 `20261109000100_initial_schema.sql`, Day 2 `20261110000100_paypal_support.sql`, Day 3 `20261111000100_collections_agent_rag.sql`, then Day 4 `20261112000100_day4_reporting_and_limits.sql`. Enable the `vector` extension before Day 3. Day 3 and Day 4 check for earlier schema prerequisites. Day 4 adds customer reporting functions and per-user limits of 8 agent requests and 3 document uploads per 60-second window.

### Environment Variables

Add the required credentials to `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

# Server-only Supabase secret key; never prefix with NEXT_PUBLIC_ or commit its value.
SUPABASE_SECRET_KEY=

# PayPal Developer Sandbox app and webhook values.
PAYPAL_ENV=sandbox
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
APP_URL=http://localhost:3008

# Server-only Groq inference
GROQ_API_KEY=
GROQ_MODEL=qwen/qwen3.8-27b
TRANSFORMERS_CACHE_DIR=
```

Never commit `.env.local` or expose secret keys in frontend code.

### Run Locally

```bash
npm run dev
```

Open:

```text
http://localhost:3008
```

With Supabase credentials missing or migrations unapplied, LedgerLoop shows setup guidance rather than demo records. The collections assistant needs the Day 3 migration, a valid Groq key, and a one-time local download of the embedding model. PayPal links and checkout require the server-only Supabase key and Sandbox app configuration. See [README_DAY1.md](README_DAY1.md), [README_DAY2.md](README_DAY2.md), [README_DAY3.md](README_DAY3.md), and [README_DAY4.md](README_DAY4.md) for milestone details.

## 🗺️ Roadmap

- [x] Application foundation and authentication.
- [x] Invoice and customer management.
- [x] Receivables dashboard.
- [x] PayPal order, capture, and webhook integration code (Sandbox end-to-end verification pending configuration).
- [x] Collections Agent with backend tool calling and business-scoped policy retrieval.
- [x] Overdue invoice analysis and deterministic prioritisation.
- [x] Personalised reminder drafts for owner review.
- [x] Approval workflow and persisted agent activity history.
- [x] Password recovery, route error pages, responsive record views, and history filters.
- [ ] Testing and deployment.
- [ ] Documentation and demonstration.

## 🎯 Project Vision

We believe financial operations should be easier to understand and manage.

LedgerLoop aims to help small businesses spend less time chasing payments and more time building their businesses.

**One platform. Smarter collections. Verified payments.**

## 🤝 Contributing

Contributions, suggestions, and feedback are welcome!

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Submit a pull request.

## 📄 License

No `LICENSE` file is included yet. Choose and add a license before distributing the project.

---

<div align="center">

### Built with purpose. Designed for better financial operations.

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:172B24,50:28684F,100:D7B77A&height=120&section=footer" width="100%" />

</div>
