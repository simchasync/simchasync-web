export type EventPaymentStatus = "paid" | "partial" | "unpaid";

/**
 * Resolves the payment status shown in lists and detail UIs. When invoices are
 * linked to the event, their statuses take precedence over `events.payment_status`
 * (e.g. invoice marked paid while the event row is still "unpaid").
 */
export function getEventPaymentStatus(
  event: { payment_status?: string | null },
  linkedInvoices: { status: string }[]
): EventPaymentStatus {
  if (!linkedInvoices.length) {
    return (event.payment_status as EventPaymentStatus) || "unpaid";
  }
  if (linkedInvoices.every((inv) => inv.status === "paid")) return "paid";
  if (linkedInvoices.some((inv) => inv.status === "paid" || inv.status === "sent")) return "partial";
  return "unpaid";
}
