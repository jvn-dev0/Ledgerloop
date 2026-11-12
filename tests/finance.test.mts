import assert from "node:assert/strict";
import test from "node:test";
import { formatMoney, normalizeAmount, sumAmounts } from "../lib/finance/money.ts";
import { toPayPalAmount } from "../lib/paypal/amount.ts";
import { formatDate, formatDateTime } from "../lib/finance/date.ts";

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

test("formats date-only values without shifting the calendar day", () => {
  assert.equal(formatDate("2026-11-10"), "Nov 10, 2026");
});

test("formats financial timestamps with an explicit UTC zone", () => {
  assert.match(formatDateTime("2026-11-10T14:30:00.000Z"), /Nov 10, 2026/);
  assert.match(formatDateTime("2026-11-10T14:30:00.000Z"), /UTC/);
  assert.equal(formatDateTime("not-a-date"), "not-a-date");
});

test("formats PayPal amounts to the currency exponent without floating-point conversion", () => {
  assert.equal(toPayPalAmount("19.900000", "USD"), "19.90");
  assert.equal(toPayPalAmount("19", "JPY"), "19");
  assert.equal(toPayPalAmount("1.234", "USD"), null);
  assert.equal(toPayPalAmount("0.000000", "USD"), null);
  assert.equal(toPayPalAmount("1.234", "KWD"), "1.234");
  assert.equal(toPayPalAmount("1.00", "XXX"), null);
});
