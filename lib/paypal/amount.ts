import { currencyScale, isCurrency } from "../finance/money.ts";

const DECIMAL_AMOUNT = /^(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/;

/** Converts a database decimal to PayPal's currency-specific decimal format without floating-point math. */
export function toPayPalAmount(value: string, currency: string): string | null {
  const input = value.trim();
  if (!DECIMAL_AMOUNT.test(input) || !isCurrency(currency)) return null;

  const [whole, rawFraction = ""] = input.split(".");
  const fraction = rawFraction.replace(/0+$/, "");
  const scale = currencyScale(currency);
  if (fraction.length > scale) return null;
  if (BigInt(whole) === 0n && BigInt(fraction || "0") === 0n) return null;

  return scale === 0 ? whole : `${whole}.${fraction.padEnd(scale, "0")}`;
}
