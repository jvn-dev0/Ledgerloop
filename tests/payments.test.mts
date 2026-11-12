import assert from "node:assert/strict";
import test from "node:test";
import { getReconciliationStatus } from "../lib/payments/reconciliation.js";

const capturedAttempt = {
  status: "captured" as const,
  provider_capture_id: "CAPTURE-123",
  amount: "120.000000",
  currency: "USD",
};

test("capture is reconciled only when the paid invoice matches amount and currency", () => {
  assert.equal(getReconciliationStatus(capturedAttempt, {
    status: "paid",
    amount: "120.00",
    currency: "USD",
  }), "reconciled");
});

test("captured payments need review when the invoice is unpaid or mismatched", () => {
  assert.equal(getReconciliationStatus(capturedAttempt, {
    status: "pending",
    amount: "120.00",
    currency: "USD",
  }), "review_required");
  assert.equal(getReconciliationStatus(capturedAttempt, {
    status: "paid",
    amount: "119.00",
    currency: "USD",
  }), "review_required");
  assert.equal(getReconciliationStatus(capturedAttempt, {
    status: "paid",
    amount: "120.00",
    currency: "EUR",
  }), "review_required");
});

test("captured payments without a persisted capture reference need review", () => {
  assert.equal(getReconciliationStatus({ ...capturedAttempt, provider_capture_id: null }, {
    status: "paid",
    amount: "120.00",
    currency: "USD",
  }), "review_required");
});

test("unsettled, failed, and cancelled attempts are not labelled reconciled", () => {
  assert.equal(getReconciliationStatus({ ...capturedAttempt, status: "approved" }, null), "not_yet_reconciled");
  assert.equal(getReconciliationStatus({ ...capturedAttempt, status: "failed" }, null), "failed");
  assert.equal(getReconciliationStatus({ ...capturedAttempt, status: "cancelled" }, null), "cancelled");
});
