type PaymentAttempt = {
  status: "created" | "pending_approval" | "approved" | "captured" | "failed" | "cancelled";
  provider_capture_id: string | null;
  amount: string;
  currency: string;
};

type ReconciliationInvoice = {
  status: string;
  amount: string;
  currency: string;
} | null | undefined;

export const PAYMENT_STATUS_LABELS = {
  created: "Created",
  pending_approval: "Awaiting customer approval",
  approved: "Approved",
  captured: "Captured",
  failed: "Failed",
  cancelled: "Cancelled",
} as const;

export const RECONCILIATION_STATUS_LABELS = {
  reconciled: "Reconciled",
  review_required: "Review required",
  not_yet_reconciled: "Not yet reconciled",
  failed: "Failed",
  cancelled: "Cancelled",
} as const;

export type ReconciliationStatus = keyof typeof RECONCILIATION_STATUS_LABELS;

function canonicalPersistedAmount(value: string) {
  const input = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(input)) return null;
  const [whole, fraction = ""] = input.split(".");
  const significantFraction = fraction.replace(/0+$/, "");
  return significantFraction ? `${whole}.${significantFraction}` : whole;
}

export function getReconciliationStatus(attempt: PaymentAttempt, invoice: ReconciliationInvoice): ReconciliationStatus {
  if (attempt.status === "failed") return "failed";
  if (attempt.status === "cancelled") return "cancelled";
  if (attempt.status !== "captured") return "not_yet_reconciled";
  if (!attempt.provider_capture_id || !invoice || invoice.status !== "paid" || attempt.currency !== invoice.currency) {
    return "review_required";
  }

  const capturedAmount = canonicalPersistedAmount(attempt.amount);
  const invoiceAmount = canonicalPersistedAmount(invoice.amount);
  if (!capturedAmount || !invoiceAmount || capturedAmount !== invoiceAmount) return "review_required";
  return "reconciled";
}
