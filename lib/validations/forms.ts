import { isCurrency, normalizeAmount } from "../finance/money.ts";

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type CustomerInput = {
  name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  notes: string | null;
  collection_contact_preference: "email" | "phone" | "portal" | null;
};

export type InvoiceInput = {
  customer_id: string;
  invoice_number: string;
  description: string;
  amount: string;
  currency: string;
  issue_date: string;
  due_date: string;
  status: "draft" | "pending" | "cancelled";
};

export type BusinessSettingsInput = {
  name: string;
  default_currency: string;
};

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optional(value: string) {
  return value ? value : null;
}

export function parseBusinessSettings(formData: FormData): ValidationResult<BusinessSettingsInput> {
  const name = field(formData, "name");
  const defaultCurrency = field(formData, "default_currency").toUpperCase();
  if (name.length < 1 || name.length > 120) return { ok: false, error: "Enter a business name under 120 characters." };
  if (!isCurrency(defaultCurrency)) return { ok: false, error: "Choose a valid ISO currency code." };
  return { ok: true, data: { name, default_currency: defaultCurrency } };
}

export function parseCustomer(formData: FormData): ValidationResult<CustomerInput> {
  const name = field(formData, "name");
  const email = field(formData, "email").toLowerCase();
  const phone = field(formData, "phone");
  const companyName = field(formData, "company_name");
  const notes = field(formData, "notes");
  const collectionPreference = field(formData, "collection_contact_preference");

  if (name.length < 1 || name.length > 160) return { ok: false, error: "Enter a customer name under 160 characters." };
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (phone.length > 40) return { ok: false, error: "Phone number must be 40 characters or fewer." };
  if (companyName.length > 160) return { ok: false, error: "Company name must be 160 characters or fewer." };
  if (notes.length > 4000) return { ok: false, error: "Notes must be 4,000 characters or fewer." };
  if (collectionPreference && !["email", "phone", "portal"].includes(collectionPreference)) return { ok: false, error: "Choose a valid collection contact preference." };

  return { ok: true, data: { name, email, phone: optional(phone), company_name: optional(companyName), notes: optional(notes), collection_contact_preference: collectionPreference ? collectionPreference as "email" | "phone" | "portal" : null } };
}

export function parseInvoice(formData: FormData): ValidationResult<InvoiceInput> {
  const customerId = field(formData, "customer_id");
  const invoiceNumber = field(formData, "invoice_number");
  const description = field(formData, "description");
  const currency = field(formData, "currency").toUpperCase();
  const amount = normalizeAmount(field(formData, "amount"), currency);
  const issueDate = field(formData, "issue_date");
  const dueDate = field(formData, "due_date");
  const status = field(formData, "status");

  if (!/^[0-9a-f-]{36}$/i.test(customerId)) return { ok: false, error: "Choose a customer for this invoice." };
  if (invoiceNumber.length < 1 || invoiceNumber.length > 64) return { ok: false, error: "Enter an invoice number under 64 characters." };
  if (description.length < 1 || description.length > 2000) return { ok: false, error: "Enter a description under 2,000 characters." };
  if (!isCurrency(currency)) return { ok: false, error: "Enter a valid three-letter currency code." };
  if (!amount) return { ok: false, error: `Enter an amount greater than zero with up to ${new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2} decimal places.` };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate) || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return { ok: false, error: "Enter valid issue and due dates." };
  const parsedIssue = new Date(`${issueDate}T00:00:00.000Z`);
  const parsedDue = new Date(`${dueDate}T00:00:00.000Z`);
  if (Number.isNaN(parsedIssue.getTime()) || Number.isNaN(parsedDue.getTime()) || parsedIssue.toISOString().slice(0, 10) !== issueDate || parsedDue.toISOString().slice(0, 10) !== dueDate) return { ok: false, error: "Enter valid calendar dates." };
  if (dueDate < issueDate) return { ok: false, error: "The due date cannot be before the issue date." };
  if (!(status === "draft" || status === "pending" || status === "cancelled")) return { ok: false, error: "Choose a valid invoice status." };

  return { ok: true, data: { customer_id: customerId, invoice_number: invoiceNumber, description, amount, currency, issue_date: issueDate, due_date: dueDate, status } };
}
