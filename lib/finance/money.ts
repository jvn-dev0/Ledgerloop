const MAX_SCALE = 6;
const AMOUNT_PATTERN = /^(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/;

export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY", "KWD"] as const;

export function currencyScale(currency: string) {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

export function normalizeAmount(value: string, currency: string): string | null {
  const input = value.trim();
  if (!AMOUNT_PATTERN.test(input)) return null;
  const scale = currencyScale(currency);
  const [whole, fraction = ""] = input.split(".");
  if (fraction.length > scale) return null;
  const padded = fraction.padEnd(scale, "0");
  const units = BigInt(whole) * 10n ** BigInt(scale) + BigInt(padded || "0");
  if (units <= 0n) return null;
  return scale === 0 ? whole : `${whole}.${padded}`;
}

function toScaledUnits(value: string) {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 10n ** BigInt(MAX_SCALE) + BigInt(fraction.padEnd(MAX_SCALE, "0").slice(0, MAX_SCALE) || "0");
}

function fromScaledUnits(value: bigint) {
  const scale = 10n ** BigInt(MAX_SCALE);
  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(MAX_SCALE, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function sumAmounts(values: string[]) {
  return fromScaledUnits(values.reduce((total, value) => total + toScaledUnits(value), 0n));
}

export function formatMoney(value: string, currency: string, locale = "en-US") {
  const [whole, fraction = ""] = value.split(".");
  const digits = currencyScale(currency);
  const template = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).formatToParts(0n);
  const groupedWhole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(BigInt(whole));
  let insertedWhole = false;
  return template.map((part) => {
    if (part.type === "integer") {
      if (insertedWhole) return "";
      insertedWhole = true;
      return groupedWhole;
    }
    if (part.type === "fraction") return fraction.padEnd(digits, "0").slice(0, digits);
    return part.value;
  }).join("");
}

export function isCurrency(value: string): boolean {
  if (!/^[A-Z]{3}$/.test(value)) return false;
  try {
    return Intl.supportedValuesOf("currency").includes(value);
  } catch {
    return false;
  }
}
