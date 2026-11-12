# LedgerLoop — Day 3

## Collections intelligence with retrieval and approval gates

Day 3 adds a real, server-side collections assistant to the Day 1 customer/invoice workspace and Day 2 PayPal integration. It uses Groq's Qwen 3.8 27B model for language and tool-call proposals, while application code and Supabase remain authoritative for invoice balances, customer history, payment status, and access control.

The selected Groq model is currently listed as **Preview**. Groq documents tool use, JSON object/schema modes, a 131,042-token context window, and Qwen 3.8's availability for Free and Developer tiers; exact organization quotas vary. The application validates every proposed tool input and output with Zod. See [Groq's model page](https://console.groq.com/docs/model/qwen/qwen3.8-27b), [tool-use documentation](https://console.groq.com/docs/tool-use/overview), [rate limits](https://console.groq.com/docs/rate-limits), and [billing FAQ](https://console.groq.com/docs/billing-faqs).

## Day 3 features

- Streaming assistant replies and tool progress in `/assistant`.
- Ten typed, business-scoped tools for receivables summary, invoice/customer lookups, overdue analysis, policy retrieval, deterministic prioritisation, reminder drafting, approval requests, and verified PayPal payment status.
- Deterministic prioritisation that explains overdue days, invoice age, same-currency balance rank, prior recorded payment history, and reminder drafts.
- A saved customer collection-contact preference (email, phone, or portal) used to label and format reminder previews.
- PDF, Markdown, and plain-text policy ingestion with file, page, character, and chunk limits.
- Local `Supabase/gte-small` embeddings (384 dimensions) using Transformers.js; vectors and chunks are stored in Supabase PostgreSQL with pgvector. The model is English-only and uses up to 512 input tokens per chunk, so non-English policy text and very long chunks need care ([model card](https://huggingface.co/Supabase/gte-small)).
- Human-reviewed reminder drafts. The app does not send email.
- Human approval before a tool creates a PayPal payment link. It does not capture a payment.
- Persistent conversations, tool activity summaries, and approval records with business-scoped RLS.

## Security boundaries

- `GROQ_API_KEY` and `SUPABASE_SECRET_KEY` are server-only. Keep them in `.env.local`; never prefix them with `NEXT_PUBLIC_`, expose them in client code, or commit them.
- The Supabase secret key bypasses RLS. It is used only by server code for the existing PayPal link flow and for an owner-authorized approval transition. User-scoped Supabase clients validate the signed-in owner and business before the server uses privileged access.
- The model receives the current user request and the minimum business data returned by tools. Contact destinations are not returned to the model. It cannot issue SQL or choose another business ID.
- Knowledge document retrieval checks business ownership in the database function. Retrieved passages are treated as untrusted reference text.
- The agent cannot send email or capture PayPal payments. A customer payment is recorded only by the existing verified PayPal flow.
- No sample financial records or mock payment result are included.

## Setup

1. Create `.env.local` from `.env.example`.
2. Configure the Supabase URL and publishable key, plus the server-only `SUPABASE_SECRET_KEY`.
3. Add a new Groq API key as `GROQ_API_KEY`. `GROQ_MODEL` defaults to `qwen/qwen3.8-27b`.
4. Configure the PayPal Sandbox variables if using payment links or checkout.
5. Apply the Day 1, Day 2, then Day 3 migrations in order:
   - `supabase/migrations/20261109000100_initial_schema.sql`
   - `supabase/migrations/20261110000100_paypal_support.sql`
   - `supabase/migrations/20261111000100_collections_agent_rag.sql`
6. Confirm that the Supabase `vector` extension is enabled before applying Day 3. The Day 3 migration stops before changing tables if required Day 1/2 objects or pgvector are missing.
7. Start the application with `npm run dev` and open `http://localhost:3008/assistant` after signing in.

Set `TRANSFORMERS_CACHE_DIR` only if you want model files stored at a writable path other than the operating system's temporary directory.

The first policy-document ingestion downloads the embedding model through Hugging Face if it is not cached locally. Inference runs on the application server; there is no hosted embedding API call. Model files are cached in the operating system's temporary directory by default; set `TRANSFORMERS_CACHE_DIR` to a writable persistent path where the host provides persistent disk.

## Verification commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Unit tests cover exact receivables arithmetic, deterministic scoring, model response parsing, tool-loop input/output validation and bounds, document chunking, customer contact preference validation, and retrieval scope behavior. A real finance workflow additionally requires the migrations and a signed-in Supabase user. A live Groq call additionally requires a rotated valid `GROQ_API_KEY`; PayPal approval execution requires PayPal Sandbox configuration.

The real local embedding smoke test returned 384 finite values. On this development machine, the cold download/initialization plus first embedding took 109.7 seconds; a cached-process startup plus first embedding took 789 ms, and ten additional short texts took 51 ms. These single-run measurements are not production benchmarks; see [the performance notes](docs/performance-and-complexity.md).

## Limits

- Agent history is bounded to ten earlier messages and user requests to 2,000 characters. The default orchestration allows five tool turns plus a final answer turn; the hard cap allows six tool turns plus a final answer turn.
- The model may propose at most three tool calls per response; each tool validates its own arguments and bounds returned rows.
- Prioritisation loads at most the 100 oldest overdue invoices.
- Document uploads are limited to 10 MB, 80 PDF pages, 250,000 extracted characters, and 300 chunks.
- Retrieval returns at most eight policy chunks.
- Groq publishes a Free tier; requests stop with a rate-limit response when the account quota is reached. The public per-model table lists Qwen 3.8's Developer-plan base rate as 30 requests/minute, 1,000/day, 8,000 tokens/minute, and 200,000/day. These are not the Free-tier quotas; check the account's Limits page for its exact current quota.

## Detailed performance notes

See [performance and complexity notes](docs/performance-and-complexity.md) for scoring, vector retrieval, document ingestion, reminder generation, and 10,000-invoice/1,000-document examples. These are complexity estimates; they are not a benchmark against production data.
