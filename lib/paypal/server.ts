import "server-only";

import { createHash } from "node:crypto";

const SANDBOX_BASE_URL = "https://api-m.sandbox.paypal.com";
const LIVE_BASE_URL = "https://api-m.paypal.com";

type PayPalEnvironment = "sandbox" | "live";
type PayPalConfig = { clientId: string; clientSecret: string; baseUrl: string; environment: PayPalEnvironment };

type AccessTokenResponse = { access_token?: string; expires_in?: number; error?: string };

let cachedToken: { value: string; expiresAt: number } | undefined;

export class PayPalRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "PayPalRequestError";
  }
}

function getPayPalConfig(): PayPalConfig {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  const environment = (process.env.PAYPAL_ENV?.trim() || "sandbox") as PayPalEnvironment;
  if (!clientId || !clientSecret) throw new Error("PayPal Sandbox credentials are not configured.");
  if (environment !== "sandbox" && environment !== "live") throw new Error("PAYPAL_ENV must be sandbox or live.");
  if (environment === "live" && process.env.NODE_ENV !== "production") {
    throw new Error("Live PayPal payments are disabled outside production.");
  }

  const expectedBaseUrl = environment === "sandbox" ? SANDBOX_BASE_URL : LIVE_BASE_URL;
  const baseUrl = process.env.PAYPAL_BASE_URL?.trim() || expectedBaseUrl;
  if (baseUrl !== expectedBaseUrl) throw new Error("PAYPAL_BASE_URL does not match PAYPAL_ENV.");
  return { clientId, clientSecret, baseUrl, environment };
}

export function getPayPalCheckoutConfig() {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  if (!clientId || !process.env.PAYPAL_CLIENT_SECRET?.trim()) return null;
  try {
    const config = getPayPalConfig();
    return { clientId: config.clientId, environment: config.environment };
  } catch {
    return null;
  }
}

export function hashPaymentLinkToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function getAccessToken(config: PayPalConfig) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;

  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const response = await fetch(`${config.baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  let payload: AccessTokenResponse;
  try {
    payload = (await response.json()) as AccessTokenResponse;
  } catch {
    throw new PayPalRequestError("PayPal authentication returned an invalid response.", response.status);
  }
  if (!response.ok || !payload.access_token) {
    cachedToken = undefined;
    throw new PayPalRequestError("PayPal authentication failed. Check the Sandbox app credentials.", response.status);
  }

  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + Math.max(0, (payload.expires_in ?? 300) - 60) * 1000,
  };
  return cachedToken.value;
}

export async function paypalRequest<T>(path: string, options: { method: "GET" | "POST"; body?: unknown; requestId?: string }): Promise<T> {
  const config = getPayPalConfig();
  const accessToken = await getAccessToken(config);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  if (options.requestId) headers["PayPal-Request-Id"] = options.requestId;

  const response = await fetch(`${config.baseUrl}${path}`, {
    method: options.method,
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new PayPalRequestError("PayPal returned an invalid response.", response.status);
  }
  if (!response.ok) {
    const message = response.status === 422
      ? "PayPal could not process this payment request."
      : "PayPal request failed. Please try again.";
    throw new PayPalRequestError(message, response.status);
  }
  return payload as T;
}

export async function verifyPayPalWebhook(event: unknown, headers: Headers) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();
  if (!webhookId) throw new Error("PayPal webhook verification is not configured.");

  const requiredHeaders = {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
  };
  if (Object.values(requiredHeaders).some((value) => !value)) return false;

  const result = await paypalRequest<{ verification_status?: string }>("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: { ...requiredHeaders, webhook_id: webhookId, webhook_event: event },
  });
  return result.verification_status === "SUCCESS";
}
