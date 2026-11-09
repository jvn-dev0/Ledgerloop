"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

type ButtonInstance = { render(target: HTMLElement): Promise<void> | void; close?: () => Promise<void> | void };
type PayPalNamespace = {
  Buttons(options: {
    createOrder(): Promise<string>;
    onApprove(data: { orderID: string }): Promise<void>;
    onCancel(data: { orderID?: string }): Promise<void>;
    onError(error: Error): void;
  }): ButtonInstance;
};

declare global {
  interface Window { paypal?: PayPalNamespace }
}

type CheckoutStatus = { kind: "idle" | "working" | "success" | "cancelled" | "error"; message?: string };

export function PayPalCheckout({ token, clientId, currency }: { token: string; clientId: string; currency: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [status, setStatus] = useState<CheckoutStatus>({ kind: "idle" });
  const [mountError, setMountError] = useState<string | null>(null);

  const createOrder = useCallback(async () => {
    setStatus({ kind: "working", message: "Creating a PayPal order…" });
    const response = await fetch("/api/paypal/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const result = (await response.json()) as { orderID?: string; error?: string };
    if (!response.ok || !result.orderID) throw new Error(result.error || "PayPal could not start checkout.");
    setStatus({ kind: "working", message: "PayPal order created. Waiting for customer approval…" });
    return result.orderID;
  }, [token]);

  const onApprove = useCallback(async ({ orderID }: { orderID: string }) => {
    setStatus({ kind: "working", message: "PayPal approved this order. Capturing and verifying payment…" });
    const response = await fetch("/api/paypal/capture-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, orderID }),
    });
    const result = (await response.json()) as { status?: string; captureID?: string; error?: string };
    if (!response.ok || result.status !== "COMPLETED" || !result.captureID) {
      throw new Error(result.error || "PayPal has not confirmed a completed payment.");
    }
    setStatus({ kind: "success", message: "Payment completed and confirmed. You can close this page." });
  }, [token]);

  const onCancel = useCallback(async ({ orderID }: { orderID?: string }) => {
    if (!orderID) {
      setStatus({ kind: "cancelled", message: "Checkout was closed. No payment was recorded." });
      return;
    }
    setStatus({ kind: "working", message: "Checking the PayPal order state…" });
    try {
      const response = await fetch("/api/paypal/cancel-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, orderID }),
      });
      const result = (await response.json()) as { status?: string; message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "PayPal could not confirm the checkout state.");
      if (result.status === "cancelled") {
        setStatus({ kind: "cancelled", message: "Checkout was cancelled. No payment was recorded." });
      } else {
        setStatus({ kind: "error", message: result.message || "Payment state is still being checked. Return here to resume checkout safely." });
      }
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "PayPal could not confirm the checkout state." });
    }
  }, [token]);

  useEffect(() => {
    if (!sdkReady || !containerRef.current || !window.paypal) return;
    let mounted = true;
    const buttons = window.paypal.Buttons({
      createOrder,
      onApprove,
      onCancel,
      onError: (error) => setStatus({ kind: "error", message: error.message || "PayPal checkout could not be completed." }),
    });
    void Promise.resolve(buttons.render(containerRef.current)).catch((error: unknown) => {
      if (mounted) setMountError(error instanceof Error ? error.message : "PayPal buttons could not be displayed.");
    });
    return () => {
      mounted = false;
      void buttons.close?.();
    };
  }, [createOrder, onApprove, onCancel, sdkReady]);

  return (
    <div className="paypal-checkout">
      <Script
        src={`https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}&intent=capture&components=buttons`}
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
        onError={() => setMountError("PayPal checkout could not load. Check your connection and Sandbox client ID.")}
      />
      <div ref={containerRef} />
      {status.message && <p className={`checkout-status ${status.kind}`} role={status.kind === "error" ? "alert" : "status"} aria-live="polite">{status.message}</p>}
      {mountError && <p className="checkout-status error" role="alert">{mountError}</p>}
    </div>
  );
}
