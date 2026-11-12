import { notFound } from "next/navigation";
import { formatMoney } from "@/lib/finance/money";
import { findCheckoutInvoice } from "@/lib/paypal/checkout";
import { getPayPalCheckoutConfig } from "@/lib/paypal/server";
import { hasSupabaseAdminConfig } from "@/lib/supabase/env";
import { PayPalCheckout } from "@/components/payments/paypal-checkout";
import { formatDate } from "@/lib/finance/date";
import { LegalLinks } from "@/components/legal/legal-links";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: "Pay invoice · LedgerLoop", robots: { index: false, follow: false } };
}

export default async function PayInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!hasSupabaseAdminConfig()) {
    return <CheckoutUnavailable message="The business has not finished setting up secure invoice payments." />;
  }

  let invoice;
  try {
    invoice = await findCheckoutInvoice(token);
  } catch (error) {
    console.error("Public invoice checkout could not be loaded", error);
    return <CheckoutUnavailable message="Secure invoice checkout is temporarily unavailable." />;
  }
  if (!invoice) notFound();

  const paypal = getPayPalCheckoutConfig();
  const payable = invoice.status === "pending";
  const dueDate = formatDate(invoice.due_date, "long");

  return (
    <main id="main-content" tabIndex={-1} className="checkout-page">
      <header className="checkout-brand"><span className="brand-mark">L</span><span>LedgerLoop</span></header>
      <div className="checkout-layout">
        <section className="checkout-intro">
          <p className="checkout-kicker">Secure invoice payment</p>
          <h1>{invoice.business?.name ?? "Invoice payment"}</h1>
          <p>Review the invoice details and complete payment through PayPal.</p>
          <div className="checkout-note"><span className="checkout-lock">✓</span><span>Your payment is verified with PayPal before the invoice is marked paid.</span></div>
        </section>
        <section className="checkout-card" aria-labelledby="invoice-heading">
          <div className="checkout-card-head"><div><p className="checkout-label">Invoice</p><h2 id="invoice-heading">{invoice.invoice_number}</h2></div><span className={`checkout-state ${payable ? "due" : invoice.status}`}>{payable ? "Payment due" : invoice.status === "paid" ? "Paid" : "Unavailable"}</span></div>
          <p className="checkout-description">{invoice.description}</p>
          <div className="checkout-total"><span>Amount due</span><strong>{formatMoney(invoice.amount, invoice.currency)}</strong></div>
          <dl className="checkout-details"><div><dt>Bill to</dt><dd>{invoice.customer?.name ?? "Customer"}</dd></div><div><dt>Email</dt><dd>{invoice.customer?.email ?? "—"}</dd></div><div><dt>Due date</dt><dd>{dueDate}</dd></div></dl>
          <div className="checkout-divider" />
          {invoice.status === "paid" ? <p className="checkout-status success" role="status">This invoice has already been paid.</p> : invoice.status !== "pending" ? <p className="checkout-status error" role="status">This invoice is not open for payment.</p> : paypal ? <PayPalCheckout token={token} clientId={paypal.clientId} currency={invoice.currency} /> : <p className="checkout-status unavailable" role="status">PayPal Sandbox is not configured yet. The business owner needs to add the Sandbox app credentials.</p>}
          <p className="checkout-security">{paypal?.environment === "live" ? "Checkout is processed by PayPal. LedgerLoop does not store card details." : "Checkout runs in PayPal Sandbox during testing. LedgerLoop does not store card details."}</p>
        </section>
      </div>
      <footer className="checkout-footer">A payment receipt is confirmed only after PayPal reports a successful capture.<LegalLinks className="checkout-legal-links" /></footer>
    </main>
  );
}

function CheckoutUnavailable({ message }: { message: string }) {
  return <main id="main-content" tabIndex={-1} className="checkout-page"><header className="checkout-brand"><span className="brand-mark">L</span><span>LedgerLoop</span></header><section className="checkout-card checkout-unavailable"><h1>Checkout unavailable</h1><p>{message}</p></section><footer className="checkout-footer"><LegalLinks className="checkout-legal-links" /></footer></main>;
}
