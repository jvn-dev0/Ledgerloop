import assert from "node:assert/strict";
import test from "node:test";
import { INVOICE_SORT_OPTIONS, parseInvoiceSort } from "../lib/data/invoice-sorting.js";

test("invoice sorting accepts only supported database orderings", () => {
  for (const option of INVOICE_SORT_OPTIONS) assert.equal(parseInvoiceSort(option), option);
  assert.equal(parseInvoiceSort(undefined), "newest");
  assert.equal(parseInvoiceSort("random-column"), "newest");
});
