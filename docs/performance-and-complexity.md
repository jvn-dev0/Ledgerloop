# LedgerLoop Day 1–2 Performance and Complexity Notes

This review covers the current Day 1 customer, invoice, dashboard, and payment paths. Database runtime depends on PostgreSQL's selected plan, table statistics, and data distribution, so the query bounds and index behavior below are stated separately from application algorithm costs.

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

## Collection-related data preparation

Day 3 collection analysis is intentionally not implemented in this Day 1–2 revision. No agent prompt, prioritization pass, or bulk collection payload is generated. The existing paginated invoice records and business-scoped customer lookups are bounded inputs that future work can query; there is no collection-preparation algorithm here to claim a complexity improvement for.

## Frontend resource use

- Workspace pages use Server Components by default. Client Components are limited to active navigation, customer search, payment-link actions, and the PayPal checkout button.
- Customer search debounces input and aborts stale requests. Lists render one page at a time. PayPal's script loads after the page becomes interactive.
- No charting, icon, or animation dependency was added. Dashboard status bars use four values returned by the database, not fabricated sample data.
- The UI has no unbounded client-side data set and adds no animation loop or indiscriminate memoization.
