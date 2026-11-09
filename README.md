 <div align="center">

<!-- HERO BANNER -->

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:0B132B,50:123C69,100:00C2A8&height=200&section=header&text=LedgerLoop&fontSize=65&fontColor=FFFFFF&animation=fadeIn&fontAlignY=40&desc=Complete%20Financial%20Operations&descAlignY=65&descSize=20" width="100%" />

# LedgerLoop

### Complete Financial Operations

**From unpaid invoice to verified payment.**

An accounts receivable workspace for customer records, invoices, currency-aware receivables, and verified PayPal payment processing. The Collections Agent remains a later milestone.

<br/>

![Project Status](https://img.shields.io/badge/Status-In%20Development-00C2A8?style=for-the-badge)
![Stack](https://img.shields.io/badge/Stack-Next.js%20%2B%20Supabase-123C69?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-00C2A8?style=for-the-badge)

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
[Performance Notes](docs/performance-and-complexity.md)

</div>

---

## 🌐 Overview

LedgerLoop is an intelligent financial operations platform designed for freelancers, small agencies, and service-based businesses.

Businesses often struggle with unpaid invoices, inconsistent payment follow-ups, scattered financial information, and manual payment reconciliation.

LedgerLoop brings these workflows together in one platform.

Day 1 supports authenticated customer and invoice management, with receivables summaries calculated from persisted invoice records. Day 2 adds secure PayPal checkout links, server-side order and capture handling, webhook verification, and payment reconciliation. The **LedgerLoop Collections Agent** is planned for Day 3.

Payment code uses real PayPal responses and persisted database records. Sandbox end-to-end verification requires the Day 2 migration and PayPal Sandbox credentials; the application does not simulate payment activity.

**Our goal:** Reduce manual accounts receivable work and make the journey from invoice creation to payment reconciliation simpler and more transparent.

## 📁 Project structure

```text
app/
  (workspace)/       Authenticated dashboard, customer, invoice, and payment pages
  actions/            Server actions for authentication, invoices, and payment links
  api/                Customer search and PayPal order, capture, cancel, and webhook routes
  pay/[token]/         Public invoice checkout page
  login/, signup/      Supabase Auth entry points
  setup/               Supabase configuration and migration guidance
components/
  dashboard/           Receivables metrics and summary views
  invoices/            Customer picker, invoice forms, and payment-link controls
  layout/              Workspace navigation
  payments/            PayPal checkout button
  ui/                  Shared feedback, pagination, loading, and status components
lib/
  data/                Business-scoped database queries
  finance/             Decimal-safe money and date utilities
  paypal/              Server-only PayPal API and checkout helpers
  supabase/            Server, admin, and request-scoped Supabase clients
  validations/         Server-side form validation
supabase/migrations/   PostgreSQL schema, RLS, indexes, and reconciliation functions
tests/                 Finance unit tests
types/                 Database and domain types
README.md              Product overview and local setup
README_DAY1.md         Day 1 implementation and verification notes
README_DAY2.md         Day 2 payment implementation and setup notes
docs/                  Performance and complexity notes
```

Local credentials belong in `.env.local`; generated dependencies and build/test output are excluded from Git by `.gitignore`.

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

LedgerLoop is being built in milestones. Day 1 establishes customer and invoice management, database access controls, and receivables summaries. Day 2 adds PayPal payment processing; Day 3 adds the Collections Agent.

The planned Collections Agent will help business owners review outstanding receivables and decide what to do next.

Planned agent capabilities:

1. Retrieve invoice and customer information.
2. Identify overdue and outstanding invoices.
3. Calculate outstanding amounts and overdue durations.
4. Prioritise collection activities using transparent rules and available customer history.
5. Generate personalised payment reminder drafts.
6. Prepare PayPal payment checkout sessions.
7. Verify completed payments and reconcile invoice records.

**Human approval remains part of important financial actions.** The agent assists with decisions and execution, while verified payment records remain the source of truth.

## ✨ Key Features

| Feature | Description |
|---|---|
| Customer management | Implemented with business-scoped Supabase queries and paginated lists. |
| Invoice management | Implemented with business-scoped forms, details, and paginated lists. |
| Receivables dashboard | PostgreSQL aggregation grouped by currency; requires migrations to be applied. |
| Business data isolation | Supabase Auth and row-level security policies are defined in the migrations. |
| Collections Agent | Planned for Day 3; not available yet. |
| PayPal checkout, capture, and webhooks | Day 2 code is implemented; Sandbox setup and end-to-end verification remain environment-dependent. |

## 🤖 The Collections Agent

The AI agent is planned for Day 3 and is not implemented yet.

When implemented, it will interact with application data through controlled backend tools.

Example user instruction:

> Show me all overdue invoices and tell me which customers I should follow up with first.

The planned agent workflow is:

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

The application does not currently include this agent workflow. Its design will use structured tools rather than generated financial values.

**Important design principle:** AI can interpret, analyse, and recommend. The database and verified PayPal responses determine actual balances and payment status.

## 💳 PayPal Integration

The Day 2 PayPal integration creates private invoice payment links, sends order and capture requests from the server, verifies amounts and currency against stored invoice data, and reconciles successful captures. Webhook signatures are verified with PayPal and duplicate event IDs are recorded.

The planned Sandbox integration will support:

- Creating PayPal payment orders.
- Generating checkout experiences.
- Capturing approved payments through the backend.
- Verifying payment results.
- Processing payment webhooks.
- Updating invoice records after successful verification.

Payment status is never changed simply because a customer clicks a button. A database transaction marks an attempt captured and its invoice paid only after the server verifies PayPal's completed capture.

The database prevents an invoice from being marked paid unless a matching captured payment record exists. See [README_DAY2.md](README_DAY2.md) for configuration and current verification limits.

## 🏗️ Architecture

The web app and PayPal server integration are implemented through Day 2. The Collections Agent remains planned and is not part of this release.

```text
                  LEDGERLOOP
                       |
          +------------+------------+
          |                         |
          v                         v
     Web Application          Collections Agent
          |                         |
          |                    OpenAI API
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

<p>
<img src="https://skillicons.dev/icons?i=openai" />
</p>

- OpenAI API — Runtime intelligence and tool calling.
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

OpenAI and deployment integrations are planned. PayPal integration code is present, but its Sandbox app credentials and webhook configuration must be supplied locally.

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

Apply `supabase/migrations/20261109000100_initial_schema.sql` and then `supabase/migrations/20261110000100_paypal_support.sql` in the Supabase SQL Editor before using the app. The first migration creates the business, customer, invoice, payment-attempt, and audit-log tables and their access policies. The Day 2 migration adds payment links, webhook events, and server-side reconciliation functions.

### Environment Variables

Add the required credentials to `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

# Server-only; never prefix with NEXT_PUBLIC_ or commit its value.
SUPABASE_SERVICE_ROLE_KEY=

# PayPal Developer Sandbox app and webhook values.
PAYPAL_ENV=sandbox
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
APP_URL=http://localhost:3000
```

Never commit `.env.local` or expose secret keys in frontend code.

### Run Locally

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

With Supabase credentials missing or migrations unapplied, LedgerLoop shows setup guidance rather than demo records. PayPal links and checkout require the server-only key and Sandbox app configuration. See [README_DAY1.md](README_DAY1.md) and [README_DAY2.md](README_DAY2.md) for implementation status and verification notes.

## 🗺️ Roadmap

- [x] Application foundation and authentication.
- [x] Invoice and customer management.
- [x] Receivables dashboard.
- [x] PayPal order, capture, and webhook integration code (Sandbox end-to-end verification pending configuration).
- [ ] Collections Agent with backend tool calling.
- [ ] Overdue invoice analysis and prioritisation.
- [ ] Personalised reminder generation.
- [ ] Approval workflow and audit history.
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

This project is licensed under the MIT License. See the `LICENSE` file for details.

---

<div align="center">

### Built with purpose. Designed for better financial operations.

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0B132B,50:123C69,100:00C2A8&height=120&section=footer" width="100%" />

</div>
