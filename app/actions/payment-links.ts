"use server";

import { requireWorkspace } from "@/lib/data/workspace";
import { createInvoicePaymentLinkForOwner } from "@/lib/paypal/payment-link-service";

export type PaymentLinkState = { error?: string; url?: string };

export async function createInvoicePaymentLink(
  invoiceId: string,
  previousState: PaymentLinkState,
  formData: FormData,
): Promise<PaymentLinkState> {
  void previousState;
  void formData;
  const { supabase, business, ownerId } = await requireWorkspace();
  try {
    return await createInvoicePaymentLinkForOwner({ supabase, businessId: business.id, ownerId, invoiceId });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Payment link could not be created." };
  }
}
