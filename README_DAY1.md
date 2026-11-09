# LedgerLoop — Day 1 Update

This file tracks the Day 1 application work separately from the project overview in `README.md`.

## Implemented in this checkpoint

- Next.js App Router foundation with TypeScript and Tailwind CSS.
- Supabase Auth sign-up/sign-in using server-side cookies.
- PostgreSQL migration for businesses, customers, invoices, payment attempts, and audit logs.
- Business-level row-level security policies and same-business foreign key constraints.
- Customer create, search, detail, and edit pages backed by Supabase.
- Invoice create, search, detail, and edit pages backed by Supabase.
- Currency-aware receivables summary, calculated in PostgreSQL and grouped by currency.
- Exact decimal input, summation, and formatting utilities.
- Invoice status protection: the database rejects `paid` unless a matching captured payment record exists.
- Paid invoices are immutable at the database layer.
- Payments page showing persisted attempts only; it does not simulate payment results.
- Setup and empty states that avoid presenting fabricated records.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and add the Supabase project URL and publishable key.
3. Apply `supabase/migrations/20261109000100_initial_schema.sql` using the Supabase SQL Editor.
4. Start the app with `npm run dev` and create an account at `/signup`.

The signup trigger creates one business record for each new auth user. If email confirmation is enabled in Supabase, confirm the account before signing in.

## Verification in this checkpoint

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm test` — passed (currency precision, decimal addition, and exact formatting).
- `npm run build` — passed.
- `npm audit --omit=dev` — passed with zero production dependency advisories.
- Supabase migration and authenticated create/edit/persistence checks — not run; this checkout has no `.env.local` or Supabase project credentials.
- PayPal Sandbox — not implemented; scheduled for Day 2.
- Collections Agent — not implemented; scheduled for Day 3.

## Current limitations

- Apply the migration to a Supabase project before using customer, invoice, and dashboard features.
- Payments are read-only in this checkpoint. Payment attempts can only be written by a trusted server integration.
- Invoice numbers are entered by the user and protected by a per-business unique constraint.
- Receivables summaries exclude draft and cancelled invoices and keep each currency separate.
- Overdue status is derived from `due_date` and pending status; it is not stored as a separate invoice status.
- The full development dependency tree reports eight moderate transitive `minimatch` advisories. The available forced fix downgrades `eslint-config-next` to Next.js 15, so it was not applied to this Next.js 16 app.
