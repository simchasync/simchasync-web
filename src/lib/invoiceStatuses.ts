// Lifecycle statuses for an invoice. Single source of truth for the status
// selector and any status-based logic (see eventPaymentStatus.ts).
export const INVOICE_STATUSES = ["draft", "sent", "paid", "overdue"] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export function isKnownInvoiceStatus(
  value: string | null | undefined
): value is InvoiceStatus {
  return !!value && (INVOICE_STATUSES as readonly string[]).includes(value);
}
