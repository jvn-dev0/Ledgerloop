# LedgerLoop — Day 2 Update

This checkpoint adds the PayPal payment path to Day 1 customer, invoice, and receivables workflows. It documents integration code separately from setup-dependent verification.

## Implemented in this checkpoint

- Business-owner action to create a private invoice payment URL. A 256-bit random token is returned once; only its SHA-256 hash is stored.
- Public, no-index invoice checkout page that reads the current invoice and customer records from Supabase.
- Server-side PayPal OAuth and Orders v2 requests. The client-side PayPal SDK is loaded only for the checkout button.
- Capture confirmation that checks the PayPal order state and compares exact captured amount and currency with the stored invoice and attempt.
- Atomic database reconciliation: a verified capture marks the attempt captured and invoice paid in one transaction.
- Webhook signature verification with PayPal and event-ID deduplication before handling capture events.
- Payment history with bounded pagination, order and capture references, and persisted payment states.
- Database guard against editing invoice values while an active PayPal order exists.
- Day 1–2 dashboard, navigation, form, table, status, empty, and loading presentation refinements.

## Supabase setup

1. Copy `.env.example` to `.env.local`.
2. Configure the Supabase project URL and publishable key.
3. Add `SUPABASE_SECRET_KEY` locally (the legacy `SUPABASE_SERVICE_ROLE_KEY` remains accepted). It is server-only, bypasses RLS, and must never be prefixed with `NEXT_PUBLIC_` or committed.
4. In the Supabase SQL Editor, apply these migrations in order:
   - `supabase/migrations/20261109000100_initial_schema.sql`
   - `supabase/migrations/20261110000100_paypal_support.sql`

The Day 2 migration requires permission to install `pg_trgm` in the `extensions` schema. It adds hashed payment links, webhook event records, a uniqueness guard for active attempts, trigram search indexes, and the dashboard/payment reconciliation functions.

## PayPal Sandbox setup

Create a PayPal Developer Sandbox REST app and set the following in the ignored local `.env.local`:

```env
PAYPAL_ENV=sandbox
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
APP_URL=http://localhost:3008
```

Register the webhook URL ending in `/api/paypal/webhook` in the PayPal Developer Dashboard. Subscribe to `PAYMENT.CAPTURE.COMPLETED` and `PAYMENT.CAPTURE.DENIED`. Use a reachable HTTPS webhook endpoint for PayPal delivery; local webhook delivery requires a secure tunnel configured in the Sandbox app. The configured webhook ID must be the ID for that exact endpoint.

`PAYPAL_CLIENT_SECRET` and `SUPABASE_SECRET_KEY` are secrets. Do not paste them into source files, screenshots, issues, or Git. The browser receives only the PayPal client ID.

## Checkout and reconciliation behavior

- Generate a link from a pending invoice detail page and share it with the customer.
- Starting checkout creates or resumes the stored attempt and asks PayPal to create an order.
- PayPal approval alone is not treated as payment. The server captures the order and verifies the returned order ID, completed status, amount, and currency.
- The database finalization function updates the captured attempt and paid invoice atomically. Repeated capture calls are handled idempotently.
- A closed checkout is cancelled in the database only after PayPal confirms that the order is still unapproved and cancellable.
- Webhook events are signature-verified and deduplicated by PayPal event ID. Completed captures use the same atomic reconciliation function.
- The payment list shows persisted attempts only; no sample transactions or mock payment results are generated.

## Verification status

The implementation can be typechecked, linted, unit-tested, and production-built without payment credentials. Full customer/invoice/database checks and PayPal Sandbox checkout/webhook tests require the migrations and account-specific credentials above. At the last configured-project check, Supabase did not contain `public.businesses` (`PGRST205`), and PayPal Sandbox credentials/webhook ID were not available, so live persistence and PayPal end-to-end behavior have not been confirmed.

See [docs/performance-and-complexity.md](docs/performance-and-complexity.md) for query bounds, data structures, complexity notes, and scaling limits. See [README.md](README.md) for the combined product overview and [README_DAY1.md](README_DAY1.md) for the foundation checkpoint.
