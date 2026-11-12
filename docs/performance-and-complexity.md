# LedgerLoop Day 1–3 Performance and Complexity Notes

This review covers the customer, invoice, dashboard, payment, collections-agent, and policy-retrieval paths. Database runtime depends on PostgreSQL's selected plan, table statistics, and data distribution, so query bounds and index behavior are stated separately from application algorithm costs. The figures below are complexity analysis, not production benchmarks.

## Dashboard aggregation

- **Operation:** `get_dashboard_summary_for_business` groups invoice totals and status counts by currency in PostgreSQL. Recent invoice and payment queries are separately capped at 6 and 5 rows.
- **Time:** `O(n)` over the selected business's invoices for financial aggregation; grouping adds work proportional to the number of currencies. The database may use the existing business-leading invoice index, but each eligible invoice must contribute to the sums and counts.
- **Auxiliary space:** `O(k)` for the SQL aggregate groups (`k` currencies), plus at most 11 recent activity records and their related lookup maps in the application.
- **Correctness:** Values come from persisted invoice and capture states. Amounts are never aggregated across currencies.
- **Scaling limit:** The summary reads all invoices for the business on each request. If this becomes expensive, inspect `EXPLAIN (ANALYZE, BUFFERS)` with representative data before adding a maintained rollup; any rollup must update transactionally with invoice changes.

## Invoice and customer filtering/sorting

- **Operation:** Lists are filtered and ordered in PostgreSQL, then return a range of 25 rows. Invoice search is a contains match on invoice number. Customer search matches name, email, or company name.
- **Time:** Query cost is database-plan dependent. The `pg_trgm` GIN indexes can narrow selective contains searches; the database still processes matching rows for ordering and exact result counts. Very short search strings may not benefit from trigram indexes.
- **Auxiliary space:** The Next.js page holds at most 25 list records plus their related customer records (`O(p)`, `p <= 25`). No list page loads every invoice or customer into Node.js.
- **Sorting:** Invoice list ordering uses `created_at DESC`; the existing `(business_id, created_at DESC)` B-tree index supports that access path. Customer list ordering uses the existing `(business_id, name)` index.
- **Scaling limit:** Offset pagination reads/skips prior rows as page numbers grow (`O(offset + p)` in the usual plan), and exact counts may scan all matches. Cursor pagination can replace offsets for very large lists if product requirements justify it.

## Customer search

- **Operation:** The authenticated API sanitizes and bounds the search string, scopes it to the signed-in user's business, applies indexed `ILIKE` filters, orders by name, and returns no more than 20 results.
- **Time:** Search work depends on match selectivity and PostgreSQL's GIN plan. It is not accurately described as constant time; broad or short terms can require many candidate checks and sorting.
- **Auxiliary space:** At most 20 customer objects cross into the browser (`O(20)` bounded response).
- **Optimization:** The invoice form no longer downloads the full customer table. Search is debounced, prior browser requests are aborted, and results are capped.

## Invoice-to-customer lookups

- **Operation:** Each invoice/payment page fetches its paginated invoice or payment rows, then fetches unique related customer IDs with one `IN` query and builds a JavaScript `Map`.
- **Database work:** At most one bounded related invoice query and one bounded related customer query per page; PostgreSQL can use primary/unique key indexes for these IDs. Exact planner cost varies with the plan and buffer cache.
- **Application time and space:** Building maps and rendering lookups are `O(p + c)` average time and `O(p + c)` space (`p <= 25` page rows and `c <= p` unique customers). This avoids an N+1 request per invoice and nested scans over all customers.

## Payment history retrieval

- **Operation:** Payments load 25 attempts ordered by `created_at DESC`, along with an exact count and bounded related invoice/customer lookups. Dashboard activity is separately limited to 5 attempts.
- **Database work:** The existing `(business_id, created_at DESC)` B-tree supports the page filter/order; exact count still depends on matching business rows and can dominate as history grows.
- **Auxiliary space:** `O(p)` for the application page and maps, with `p <= 25`.
- **Correctness:** The UI displays stored attempt, order, and capture references. It does not infer a captured payment from browser state.

## Duplicate active payment detection

- **Operation:** A partial unique B-tree index permits at most one active attempt per `(business_id, invoice_id)`. The order-creation endpoint checks the current attempt and relies on the unique constraint to resolve concurrent starts safely.
- **Time:** An indexed lookup or insert conflict check is typically `O(log a)` for `a` indexed active attempts; database behavior under contention adds transaction/lock wait time.
- **Auxiliary space:** The index occupies `O(a)` persistent database space; application handling retains one attempt row.
- **Correctness:** PayPal request IDs are stable for a stored attempt. Capture finalization locks the attempt and invoice and writes both final states in one transaction.

## Collections-agent orchestration

- **Operation:** Each user request makes one Groq completion at a time. The default loop allows up to five tool-calling turns and then one final answer turn (six calls total); the hard cap allows up to six tool-calling turns and one final answer turn (seven calls total). Each tool-calling response allows up to three calls, with ten previous messages, 2,000 characters per current request, and bounded tool outputs. In the usual case, total cost is the sum of model-call and selected database-tool costs; turn and call caps bound it.
- **Application memory:** `O(H + R + E)`, where `H` is the capped conversation history, `R` is bounded tool-result data, and `E` is the activity events retained for the request. The tool output serializer limits depth, collection length, and total text passed back to the model.
- **Database work:** Tool queries carry the signed-in business ID and use user-scoped Supabase clients with RLS. Invoice/customer lists are capped; exact receivables totals use the existing PostgreSQL aggregation.
- **External calls:** The language-model service receives the user request and requested business context. Provider timeouts and safe error categories prevent a stuck inference request from hanging indefinitely or echoing provider internals.

## Collection prioritisation

- **Operation:** The tool first queries at most the 100 oldest overdue invoices, then fetches unique customers and groups payment history and prior reminder-draft counts in bulk. It excludes the candidate invoices from the separate history aggregation.
- **Time:** For `n` candidates, validation/grouping and final ordering are `O(n log n)`: unique balances are sorted once per currency, ranks are then read from maps, and candidates receive one final sort. Database aggregation cost depends on the matching customer invoices and reminder events. In the agent flow, `n <= 100`.
- **Auxiliary space:** `O(n + k)` for candidate records, per-currency groups and balance-rank maps, history/reminder lookup maps, and the sorted result (`k` currencies).
- **Score:** Priority combines overdue days, invoice age, relative same-currency balance, the customer's pending/other-invoice ratio, and previous reminder drafts. A larger pending share raises follow-up priority; no history is neutral. The score is transparent and rule-based, not an AI-generated probability of payment.
- **Currency correctness:** Relative balance ranks are grouped by currency. No cross-currency amount comparison or sum is used.

## Policy-document ingestion

- **Input limits:** A file is at most 10 MB, a PDF at most 80 pages, extracted text at most 250,000 characters, and each document at most 300 chunks. Text is normalized, hashed with SHA-256, and chunked with a 1,200-character target and 160-character overlap.
- **Time:** Text normalization and chunking are `O(L)` for `L` extracted characters. Embedding inference is model- and hardware-dependent and dominates CPU time; requests are processed in batches of eight. Saving `c` chunks costs `O(c * d)` vector payload work, where `d = 384`, plus database writes.
- **Memory:** `O(L + c*d)` for extracted text, chunk strings, and embedding values, plus the model runtime's weights and intermediate tensors. Limits bound document-derived memory, but model memory depends on the server runtime and cache.
- **Persistence:** A single `save_knowledge_document` database function inserts/replaces the document and all chunks in one transaction, avoiding partially indexed policy documents. The function checks owner identity and business ID.
- **Local model:** `Supabase/gte-small` runs through Transformers.js on the server. The model is English-only and accepts up to 512 tokens per input; the 1,200-character chunk target is intended to stay near that range for ordinary English prose. First use downloads model files if the configurable temporary/persistent cache is empty; subsequent requests reuse a process-level pipeline in that server process. No remote embeddings API request is made.

## Policy retrieval

- **Operation:** The server embeds one query and invokes a security-definer pgvector search function that checks the owner's business. The result count is clamped to 1–8 and similarity-filtered.
- **Index:** A HNSW cosine index is built on the 384-dimensional vector. Approximate search latency and recall depend on PostgreSQL statistics, HNSW settings, and candidate filtering; `O(log N)` is a useful intuition, not a guaranteed PostgreSQL runtime bound.
- **Auxiliary space:** `O(r*d)` for `r <= 8` returned vectors/passages in the app and model context. Persistent vector storage grows `O(N*d)` for `N` chunks, plus PostgreSQL tuple and HNSW index overhead.
- **Data isolation:** Business ID is part of every stored chunk and the retrieval function filters and verifies it before returning policy content.

## Reminder-draft generation

- **Operation:** One invoice, customer, and up to three policy passages are loaded with business-scoped queries. The draft is composed deterministically from the customer's name, invoice amount/currency/due date, selected tone, and saved collection contact preference; the LLM does not author financial facts.
- **Time:** `O(P + D)` for invoice/customer point lookups and retrieval of at most `P <= 3` policy passages of maximum 1,200 characters each. The separate query embedding costs one model inference and is input-length bounded.
- **Auxiliary space:** `O(P*C)` for passage text (`C <= 1,200`) plus constant-size invoice/customer fields and draft content.
- **Email delivery:** No message is sent. The generated text is a reviewable preview and the UI marks it as unsent.

## Scale examples

The brief's 1,000-document case depends on average chunks per document. The following example assumes ten chunks per document (about 10,000 vectors). These examples describe algorithm/query shape; run `EXPLAIN (ANALYZE, BUFFERS)` and profile the Node process on representative data before capacity planning.

| Dataset | Expected application behavior | Primary cost to watch |
|---|---|---|
| 10,000 invoices for one business | Dashboard aggregation reads all eligible invoices in PostgreSQL (`O(n)`); standard invoice lists still return 25 rows. Collection prioritisation still reads at most the 100 oldest overdue invoices. | Dashboard aggregate and exact count latency; inspect index use and buffer reads. |
| 1,000 customers | Customer pages stay paginated; invoice/customer joins fetch only IDs for the current page. The priority tool fetches customer rows for up to 100 candidate invoices. | Broad `ILIKE` search and count queries; short search terms are less selective. |
| 1,000 policy documents (about 10 chunks each) | About 10,000 vectors are indexed; retrieval returns at most eight chunks. | Index filtering by business and recall/latency under RLS; measure with representative tenant distribution. |

## Observed verification limits

Unit tests exercise the deterministic scorer, tool-loop caps and input/output validation, chunking, document limits, and retrieval result handling. No 10,000-invoice, 1,000-customer, or 10,000-vector production benchmark is claimed. Real database latency and end-to-end agent response time require the Day 1–3 migrations, an authenticated Supabase workspace, and a valid Groq key.

## Local embedding smoke measurement

Measured on the development Windows host with Node.js 26.2.0, Transformers.js, and the actual `Supabase/gte-small` `embedTexts()` path:

| Measurement | Input | Time | Result |
|---|---:|---:|---|
| Fresh model cache, first invocation | 1 short English text; includes model download and initialization | 109,672 ms | 384 finite dimensions |
| Cached model, new Node process | 1 short English text; model files already downloaded | 789 ms | 384 finite dimensions |
| Warm process batch | 10 short English texts | 51 ms | 10 vectors, each 384 dimensions |

These are single local smoke measurements, not a statistically representative performance benchmark. Network, disk cache, CPU, and serverless cold starts will change results. A fresh deployment may spend about two minutes downloading model assets; configure `TRANSFORMERS_CACHE_DIR` on hosts with persistent writable storage to preserve them across process restarts.

## Frontend resource use

- Workspace pages use Server Components by default. Client Components are limited to active navigation, customer search, payment-link actions, and the PayPal checkout button.
- Customer search debounces input and aborts stale requests. Lists render one page at a time. PayPal's script loads after the page becomes interactive.
- No charting, icon, or animation dependency was added. Dashboard status bars use four values returned by the database, not fabricated sample data.
- The UI has no unbounded client-side data set and adds no animation loop or indiscriminate memoization.
