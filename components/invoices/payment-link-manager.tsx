"use client";

import { useActionState, useState } from "react";
import { createInvoicePaymentLink, type PaymentLinkState } from "@/app/actions/payment-links";

const initialState: PaymentLinkState = {};

export function PaymentLinkManager({ invoiceId }: { invoiceId: string }) {
  const [state, formAction, pending] = useActionState(
    createInvoicePaymentLink.bind(null, invoiceId),
    initialState,
  );
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  async function copyLink() {
    if (!state.url) return;
    try {
      await navigator.clipboard.writeText(state.url);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }

  return (
    <section className="card payment-link-card">
      <div>
        <h2 className="card-title">Customer payment link</h2>
        <p className="page-subtitle">Create a private link the customer can use to pay this invoice through PayPal Sandbox.</p>
      </div>
      <form action={formAction}>
        <button className="button secondary" type="submit" disabled={pending}>
          {pending ? "Creating link…" : state.url ? "Create a new link" : "Create payment link"}
        </button>
      </form>
      {state.error && <p className="alert" role="alert">{state.error}</p>}
      {state.url && (
        <div className="payment-link-result">
          <label className="detail-label" htmlFor="customer-payment-url">Share this link with the customer</label>
          <input id="customer-payment-url" className="input" value={state.url} readOnly onFocus={(event) => event.currentTarget.select()} />
          <button className="button small" type="button" onClick={copyLink}>{copied ? "Copied" : "Copy link"}</button>
          <p className="page-subtitle" role={copyError ? "alert" : undefined}>{copyError ? "Clipboard access was blocked. Select the link and copy it manually." : "Creating a new link replaces the previous link for this invoice."}</p>
        </div>
      )}
    </section>
  );
}
