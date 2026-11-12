import { sumAmounts } from "../finance/money.ts";

const DAY_MS = 86_400_000;
const AMOUNT_SCALE = 6n;
const AMOUNT_FACTOR = 10n ** AMOUNT_SCALE;

export type CollectionCandidate = {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  amount: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  previousInvoiceCount: number;
  previousPaidInvoiceCount: number;
  reminderDraftCount: number;
};

export type PrioritizedCollection = CollectionCandidate & {
  daysOverdue: number;
  invoiceAgeDays: number;
  priorityScore: number;
  reasons: string[];
};

function dateValue(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const value = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(value) || new Date(value).toISOString().slice(0, 10) !== date) return null;
  return value;
}

export function daysBetween(from: string, to: string) {
  const start = dateValue(from);
  const end = dateValue(to);
  if (start === null || end === null) return null;
  return Math.floor((end - start) / DAY_MS);
}

function amountUnits(value: string) {
  if (!/^(?:0|[1-9]\d{0,19})(?:\.\d{1,6})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * AMOUNT_FACTOR + BigInt(fraction.padEnd(Number(AMOUNT_SCALE), "0"));
}

function compareAmounts(a: string, b: string) {
  const left = amountUnits(a);
  const right = amountUnits(b);
  if (left === null || right === null) return 0;
  return left < right ? -1 : left > right ? 1 : 0;
}

function relativeBalanceRanks(group: CollectionCandidate[]) {
  const ordered = [...new Set(group.map((item) => amountUnits(item.amount)?.toString()).filter((value): value is string => value !== undefined))]
    .map(BigInt)
    .sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  return new Map(ordered.map((units, rank) => [
    units.toString(),
    ordered.length <= 1 ? 0 : Math.floor((rank * 20) / (ordered.length - 1)),
  ]));
}

export function calculateReceivableTotals(invoices: Array<{ amount: string; currency: string; status: string }>) {
  const byCurrency = new Map<string, string[]>();
  for (const invoice of invoices) {
    if (invoice.status !== "pending") continue;
    const current = byCurrency.get(invoice.currency) ?? [];
    current.push(invoice.amount);
    byCurrency.set(invoice.currency, current);
  }
  return [...byCurrency.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amounts]) => ({ currency, outstanding: sumAmounts(amounts) }));
}

export function prioritizeCollections(candidates: CollectionCandidate[], today: string): PrioritizedCollection[] {
  if (dateValue(today) === null) throw new Error("The collection date is invalid.");
  const overdue = candidates.flatMap((candidate) => {
    const daysOverdue = daysBetween(candidate.dueDate, today);
    const invoiceAgeDays = daysBetween(candidate.issueDate, today);
    if (daysOverdue === null || invoiceAgeDays === null || daysOverdue <= 0 || amountUnits(candidate.amount) === null) return [];
    return [{ candidate, daysOverdue, invoiceAgeDays }];
  });
  const currencyGroups = new Map<string, CollectionCandidate[]>();
  overdue.forEach(({ candidate }) => {
    const group = currencyGroups.get(candidate.currency);
    if (group) group.push(candidate);
    else currencyGroups.set(candidate.currency, [candidate]);
  });
  const balanceRanksByCurrency = new Map(
    [...currencyGroups].map(([currency, group]) => [currency, relativeBalanceRanks(group)]),
  );

  return overdue.map(({ candidate, daysOverdue, invoiceAgeDays }) => {
    const previousInvoiceCount = Math.max(0, candidate.previousInvoiceCount);
    const previousPaidInvoiceCount = Math.max(0, Math.min(candidate.previousPaidInvoiceCount, previousInvoiceCount));
    const historyPoints = previousInvoiceCount === 0 ? 8 : Math.round(((previousInvoiceCount - previousPaidInvoiceCount) / previousInvoiceCount) * 16);
    const overduePoints = Math.min(daysOverdue, 90) * 2;
    const agePoints = Math.min(Math.floor(Math.max(0, invoiceAgeDays) / 30), 12);
    const balancePoints = balanceRanksByCurrency.get(candidate.currency)?.get(amountUnits(candidate.amount)?.toString() ?? "") ?? 0;
    const reminderPenalty = Math.min(Math.max(0, candidate.reminderDraftCount), 3) * 3;
    const priorityScore = overduePoints + agePoints + balancePoints + historyPoints - reminderPenalty;
    const reasons = [`${daysOverdue} days overdue`];
    if (balancePoints >= 16) reasons.push(`among the larger outstanding invoices in ${candidate.currency}`);
    if (previousInvoiceCount > 0) reasons.push(`customer has ${previousInvoiceCount - previousPaidInvoiceCount} pending of ${previousInvoiceCount} other pending or paid invoices on record`);
    if (candidate.reminderDraftCount > 0) reasons.push(`${candidate.reminderDraftCount} reminder draft${candidate.reminderDraftCount === 1 ? "" : "s"} already prepared`);
    return { ...candidate, daysOverdue, invoiceAgeDays, priorityScore, reasons };
  }).sort((a, b) => b.priorityScore - a.priorityScore || b.daysOverdue - a.daysOverdue || compareAmounts(b.amount, a.amount) || a.id.localeCompare(b.id));
}
