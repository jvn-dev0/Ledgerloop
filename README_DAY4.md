# LedgerLoop — Day 4

## Account recovery, safer payment states, and responsive workspaces

Day 4 improves the existing LedgerLoop application across authentication, payment reliability, and day-to-day record browsing. Changes build on the real Supabase-backed flows; no sample customers, invoices, payment results, or generated financial activity were added.

## Delivered

- Password reset requests use Supabase Auth and a PKCE callback. The callback accepts only the in-app dashboard or reset-password destination, and reset requests use the same confirmation message whether or not the email exists.
- Password updates require an authenticated recovery session, validate matching passwords, and sign out after a successful change. Supabase and PayPal error responses are not exposed in page URLs.
- Invoice history can be filtered by status, including an overdue view computed from pending invoices and their due dates, and sorted by issue date, due date, or invoice number. Payment history has status filters. Pagination keeps the selected filters.
- Customer, invoice, and payment records switch to labeled mobile cards instead of a wide table. The workspace navigation has a mobile menu and keyboard-visible focus states.
- Dashboard metric icons use inline SVGs. Touch controls, text sizing, status labels, and reduced-motion behavior were improved.
- App-level, global, and not-found boundaries provide a clear recovery path when a route fails or cannot be found.
- Payment capture and denied-webhook transitions now check whether their database state updates succeeded before reporting the resulting state.
- Agent JSON requests are capped at 8 KiB before parsing. Policy uploads are capped before multipart parsing, with a separate 10 MiB file limit.
- Database-backed rate limits cap agent requests at 8 per user per minute and policy uploads at 3 per user per minute. Rate-limit storage is private to a security-definer RPC; the table is not directly accessible to authenticated clients.
- Customer detail shows outstanding and overdue totals by currency, recent payment attempts, and saved collections activity. The dashboard shows real pending approvals and the five longest-overdue invoices.
- Signup shows a safe, actionable message when Supabase temporarily rate-limits confirmation email delivery; other signup failures remain generic.
- Workspace colors use forest, warm ivory, muted emerald/teal, amber, and coral tokens.
- Common response security headers are configured in Next.js. The local build output is isolated in the ignored `.next-build-check/` folder.
- UI/UX Pro Max guidance is initialized in `.agents/skills/` for future interface work.

## Verification

The following checks passed on 12 November 2026:

```text
npm run typecheck  — passed
npm run lint       — passed
npm test           — passed, 35 tests
npm run build      — passed with Next.js 16.4.5
GET /login, /forgot-password, and /reset-password on localhost:3008 — returned HTTP 200; unknown path returned HTTP 404
```

The hosted Supabase migration state and end-to-end password email, PayPal Sandbox, and Groq flows remain environment-dependent. Apply the Day 1, Day 2, Day 3, and Day 4 migrations in order as described in the main README. Add the configured application's `/auth/callback` URL to Supabase Auth's redirect allow-list for confirmation and password-reset emails.

## Run locally

Use Node.js 20.9 or later, configure `.env.local` from `.env.example`, apply the required Supabase migrations, then run:

```bash
npm install
npm run dev
```

Open [http://localhost:3008](http://localhost:3008). Keep `SUPABASE_SECRET_KEY`, `GROQ_API_KEY`, and PayPal secrets server-side in `.env.local`; never commit their values or expose them through `NEXT_PUBLIC_` variables.

See [the implementation audit](docs/day4-implementation-audit.md) and [the interface direction](docs/day4-design-system.md) for the codebase findings and visual decisions behind this milestone.
