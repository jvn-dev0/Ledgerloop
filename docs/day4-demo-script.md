# LedgerLoop — Three-Minute Demo Runbook

This runbook is for a real, persisted demonstration. It does not create records or simulate payments. Use a dedicated business and records you entered through LedgerLoop; label any test records clearly and use PayPal Sandbox accounts only.

## Before recording

1. Apply the four migrations listed in the README, then confirm the tables and Day 4 functions are visible in Supabase.
2. Confirm Supabase Auth email confirmation and the deployed/local `/auth/callback` redirect work. Sign in with an account you control.
3. Create a clearly labeled demo customer and invoice through the UI. Confirm they remain after refresh. Do not use another customer's data.
4. If showing the assistant, configure a rotated Groq key, add a policy document you are authorized to use, and verify a real answer against the stored records.
5. If showing checkout, configure PayPal Sandbox credentials and a Sandbox buyer. Verify a real Sandbox capture before describing an invoice as paid.
6. Use `http://localhost:3008` for a local demo. The account must be signed in; the hosted database and provider settings must be configured separately.

If any prerequisite is missing, omit that workflow and state the limitation. Do not substitute a screenshot, fabricated tool event, or hand-edited status for a live persisted result.

## Script

| Time | Show | Say |
|---|---|---|
| 0:00–0:20 | Introduce LedgerLoop and the signed-in workspace. | “LedgerLoop keeps customer records, invoices, collections context, and payment reconciliation together for a small business.” |
| 0:20–0:50 | Dashboard currency totals, overdue queue, and pending approvals. | “These figures come from this business's stored invoices. Totals stay grouped by currency, and the overdue list is ordered from the actual due dates.” |
| 0:50–1:15 | Open the demo customer: balance summary, invoices, payment/activity history. | “The customer view connects outstanding amounts and recorded activity to one business-scoped customer record.” |
| 1:15–1:40 | Open invoice list, filter/sort, then show the detail page. | “Invoice status, due date, amount, and customer details are persisted. The list can be filtered and sorted, and the same record remains after refresh.” |
| 1:40–2:15 | Ask the collections assistant to prioritize overdue invoices using a saved policy. Show tool events and evidence. | “The model proposes tool calls; the server validates them and retrieves business records. Policy text is reference material, and the generated recommendation still needs human review.” |
| 2:15–2:35 | Show a pending approval or reminder draft, and its review state. | “A recommendation is not treated as an executed action until the authorized user approves it and the result is saved.” |
| 2:35–2:55 | If Sandbox is configured, complete a PayPal Sandbox payment and show the persisted capture and reconciliation state. | “LedgerLoop marks payment only after PayPal confirms capture. The reconciliation label also checks the stored invoice amount and currency.” |
| 2:55–3:00 | End on the payment or dashboard record. | “The source of truth is the saved business record and verified payment response, not a generated demo number.” |

## Safe fallback

If the hosted schema, AI provider, approval workflow, or PayPal Sandbox is not ready, do not imply it was tested. Show only the routes that work, explain that the remaining integration is pending, and use the release report to identify the exact blocker. Never run a live payment as part of a Sandbox demo.
