# LedgerLoop interface direction

## Product and audience

LedgerLoop is a receivables workspace for small-business owners and finance operators. The daily job is to see what is outstanding, find the right customer or invoice, and follow up without confusing a draft, a PayPal attempt, and a verified capture.

## Design system

- **Midnight navy — `#0B1730`:** workspace navigation and the existing brand anchor.
- **Ledger blue — `#2868E8`:** primary actions and active links.
- **Pale ledger — `#F5F7FA`:** the application canvas around the work surface.
- **Paper — `#FFFFFF`:** forms, tables, and grouped records.
- **Ink — `#14263D`:** primary reading color.
- **Verified green — `#087E5B`:** captured payments and paid invoices; always paired with a label.
- **Due amber — `#8A5B13`:** pending and due records; overdue status also includes a text label.
- **Error red — `#B42318`:** failed operations and overdue emphasis.

The UI Pro Max search recommended a data-dense dashboard and confirmed that financial status colors need text labels, keyboard access, visible focus, reduced-motion support, and responsive checks. Its suggested sales-oriented Enterprise Gateway layout does not fit this authenticated finance workflow, so the app keeps the existing LedgerLoop brand and uses the dashboard pattern instead.

## Type and density

Use the installed system sans-serif stack so the interface does not depend on a network font request. Keep body copy at 15–16px, labels at 12–14px, and metadata at 12px or larger. Use tabular numerals for amounts, dates, and payment references. Keep supporting copy below roughly 75 characters per line.

## Layout

Desktop keeps the navy navigation rail and gives the work area a wide, quiet canvas. Each screen leads with a direct title and one primary action. Summary totals come from the business-scoped database functions; tables and status distributions use persisted records only.

```text
Desktop: [brand + navigation] [page title                         action]
                                 [receivable totals by currency]
                                 [status distribution] [recent activity]
                                 [invoice records]

Mobile:  [brand                                   menu]
         [workspace navigation, when opened]
         [business account and sign out]
         [page title                         action]
         [summary / record cards]
```

Mobile tables become labeled record cards, with their column headers retained for assistive technology. Controls target at least 44px on touch screens. Focus remains visible, and nonessential transitions respect `prefers-reduced-motion`.

## Deliberate limits

Do not add trend charts without persisted historical data. Do not add demo customers, invoices, payment attempts, fake activity, or invented company details. Use inline SVGs for application icons and keep payment status text explicit.
