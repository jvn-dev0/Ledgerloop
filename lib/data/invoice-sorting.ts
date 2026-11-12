export const INVOICE_SORT_OPTIONS = ["newest", "oldest", "due_soon", "due_late", "number_asc", "number_desc"] as const;

export type InvoiceSort = (typeof INVOICE_SORT_OPTIONS)[number];

export function parseInvoiceSort(value?: string): InvoiceSort {
  return INVOICE_SORT_OPTIONS.find((option) => option === value) ?? "newest";
}
