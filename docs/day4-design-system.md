# LedgerLoop interface direction

**Updated:** 12 November 2026

## Product and audience

LedgerLoop is a receivables workspace for small-business owners and finance operators. The daily job is to see what is outstanding, find the right customer or invoice, and follow up without confusing a draft, a PayPal attempt, and a verified capture.

## Color system

The interface uses a restrained financial palette: forest and charcoal for navigation and focus, warm ivory for the work surface, muted emerald/teal for primary actions and verified states, amber for attention, and coral for failures. The tokens live in `app/globals.css`.

| Role | Token value | Use |
| --- | --- | --- |
| Forest charcoal | `#172B24` | Sidebar, auth panel, strong brand surface |
| Deep forest | `#213E32` | Secondary dark surfaces |
| Muted emerald | `#28684F` | Primary action, links, and keyboard focus |
| Warm ivory | `#F2F0E8` | Workspace canvas |
| Paper | `#FBFAF5` | Cards and form surfaces |
| Ink | `#1D2C24` | Main content text |
| Teal | `#456F66` | Informational states and supporting accents |
| Amber | `#895B1D` | Pending and due states; paired with a label |
| Coral | `#AD493D` | Failed operations and destructive feedback |
| Verified green | `#2F7659` | Captured payment and paid invoice states |

The gold brand accent is reserved for small highlights, such as the mark and active navigation detail. Large surfaces stay calm and flat so amounts, due dates, and status labels remain easy to scan.

## Type and density

Use the installed system sans-serif stack so the interface does not depend on a network font request. Keep body copy at 15–16px, labels at 12–14px, and metadata at 12px or larger. Use tabular numerals for amounts, dates, and payment references. Keep supporting copy below roughly 75 characters per line.

## Layout and interaction

Desktop keeps a fixed forest navigation rail and a warm, wide work canvas. Each screen leads with a direct title and one primary action. Summary totals come from business-scoped database functions; tables and status distributions use persisted records only.

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

Controls target at least 44px on touch screens. Focus remains visible; status has explicit text as well as color; nonessential transitions respect `prefers-reduced-motion`. Status colors are semantic: green means verified/paid, amber means pending/due, and coral means failed.

## Component-library decisions

The project keeps its small native component set. Unlumen, Magic UI, and SmoothUI expose source components and may be adopted one at a time when a specific workflow benefits. Retro UI's pixel-art styling conflicts with the calm finance workspace. No library package or animation dependency was installed.

## Deliberate limits

Do not add trend charts without persisted historical data. Do not add demo customers, invoices, payment attempts, fake activity, or invented company details. Use inline SVGs for application icons and keep payment status text explicit.
