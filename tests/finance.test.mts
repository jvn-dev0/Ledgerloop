import assert from "node:assert/strict";
import test from "node:test";
import { formatMoney, normalizeAmount, sumAmounts } from "../lib/finance/money.ts";

test("normalizes amounts according to currency precision", () => {
  assert.equal(normalizeAmount("12", "USD"), "12.00");
  assert.equal(normalizeAmount("12.3", "KWD"), "12.300");
  assert.equal(normalizeAmount("12.01", "JPY"), null);
  assert.equal(normalizeAmount("0", "USD"), null);
  assert.equal(normalizeAmount("1e4", "USD"), null);
});

test("adds decimal amounts without floating-point rounding", () => {
  assert.equal(sumAmounts(["0.1", "0.2"]), "0.3");
  assert.equal(sumAmounts(["90071992547409.99", "0.01"]), "90071992547410");
});

test("formats large currency amounts exactly", () => {
  assert.equal(formatMoney("90071992547409.99", "USD"), "$90,071,992,547,409.99");
  assert.equal(formatMoney("1234", "JPY"), "¥1,234");
});
