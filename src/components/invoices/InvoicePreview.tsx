import { forwardRef } from "react";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  method: string;
  notes?: string | null;
}

interface InvoicePreviewProps {
  invoice: any;
  artistName?: string;
  artistLogo?: string | null;
  workspaceName?: string;
  paymentInstructions?: string | null;
  payments?: Payment[];
}

const InvoicePreview = forwardRef<HTMLDivElement, InvoicePreviewProps>(
  ({ invoice, artistName, artistLogo, workspaceName, paymentInstructions, payments = [] }, ref) => {
    const { t } = useLanguage();
    const inv = t.app.invoices;

    const statusLabel = (inv.statuses as any)[invoice.status] || invoice.status;

    return (
      <div ref={ref} className="bg-white text-gray-900 p-8 max-w-2xl mx-auto" id="invoice-preview">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 border-b border-gray-200 pb-6">
          <div className="flex items-center gap-4">
            {artistLogo ? (
              <img src={artistLogo} alt="Logo" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-xl">
                {(workspaceName || "?")[0].toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>
                {workspaceName || "Invoice"}
              </h1>
              {artistName && <p className="text-sm text-gray-500">{artistName}</p>}
            </div>
          </div>
          <div className="text-right">
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
              invoice.status === "paid" ? "bg-emerald-100 text-emerald-700" :
              invoice.status === "sent" ? "bg-blue-100 text-blue-700" :
              invoice.status === "overdue" ? "bg-red-100 text-red-700" :
              "bg-gray-100 text-gray-600"
            }`}>
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Invoice details */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Bill To</p>
            <p className="font-semibold text-gray-900">{invoice.clients?.name || "—"}</p>
            {invoice.clients?.email && <p className="text-sm text-gray-500">{invoice.clients.email}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Invoice Date</p>
            <p className="text-sm text-gray-700">{format(new Date(invoice.created_at), "MMMM d, yyyy")}</p>
            {invoice.sent_at && (
              <>
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-1 mt-3">{inv.sentAt}</p>
                <p className="text-sm text-gray-700">{format(new Date(invoice.sent_at), "MMMM d, yyyy")}</p>
              </>
            )}
          </div>
        </div>

        {/* Event info */}
        {invoice.events && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Event</p>
            <p className="font-medium text-gray-800">
              {invoice.events.event_type} — {format(new Date(invoice.events.event_date), "MMMM d, yyyy")}
            </p>
          </div>
        )}

        {/* Amount Breakdown */}
        <div className="border border-gray-200 rounded-lg overflow-hidden mb-8">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left text-xs uppercase tracking-wide text-gray-500 py-3 px-4">Description</th>
                <th className="text-right text-xs uppercase tracking-wide text-gray-500 py-3 px-4">{inv.amount}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-gray-100">
                <td className="py-4 px-4 text-gray-700">
                  {invoice.events
                    ? `${invoice.events.event_type} — ${format(new Date(invoice.events.event_date), "MMM d, yyyy")}`
                    : "Services"}
                </td>
                <td className="py-4 px-4 text-right font-semibold text-gray-900">${Number(invoice.amount).toFixed(2)}</td>
              </tr>
              {Number(invoice.overtime) > 0 && (
                <tr className="border-t border-gray-100">
                  <td className="py-4 px-4 text-gray-700">Overtime</td>
                  <td className="py-4 px-4 text-right font-semibold text-gray-900">${Number(invoice.overtime).toFixed(2)}</td>
                </tr>
              )}
            </tbody>
            {payments.length > 0 && (
              <tbody>
                <tr>
                  <td colSpan={2} className="pt-2 px-4">
                    <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Payments Received</p>
                  </td>
                </tr>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-gray-100">
                    <td className="py-2 px-4 text-sm text-gray-600">
                      {format(new Date(p.payment_date), "MMM d, yyyy")} — <span className="capitalize">{p.method.replace("_", " ")}</span>
                    </td>
                    <td className="py-2 px-4 text-right text-sm text-emerald-600">-${Number(p.amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            )}
            <tfoot>
              {payments.length > 0 && (() => {
                const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
                const contractTotal = Number(invoice.amount) + Number(invoice.overtime || 0);
                const balanceDue = contractTotal - totalPaid;
                return (
                  <>
                    <tr className="border-t border-gray-200 bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-600">Total Paid</td>
                      <td className="py-3 px-4 text-right text-sm font-medium text-emerald-700">${totalPaid.toFixed(2)}</td>
                    </tr>
                    <tr className="border-t-2 border-gray-300 bg-gray-50">
                      <td className="py-4 px-4 font-bold text-gray-900">Balance Due</td>
                      <td className="py-4 px-4 text-right font-bold text-xl text-gray-900">${balanceDue.toFixed(2)}</td>
                    </tr>
                  </>
                );
              })()}
              {payments.length === 0 && (
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td className="py-4 px-4 font-bold text-gray-900">Total</td>
                  <td className="py-4 px-4 text-right font-bold text-xl text-gray-900">${(Number(invoice.amount) + Number(invoice.overtime || 0)).toFixed(2)}</td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>

        {/* Payment Instructions */}
        {paymentInstructions && (
          <div className="mb-8 p-4 bg-amber-50 border border-amber-100 rounded-lg">
            <p className="text-xs uppercase tracking-wide text-amber-600 font-semibold mb-2">Payment Instructions</p>
            <p className="text-sm text-gray-700 whitespace-pre-line">{paymentInstructions}</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 pt-4 border-t border-gray-100">
          <p>Thank you for your business!</p>
          {invoice.stripe_payment_url && (
            <p className="mt-2">
              Pay online: <a href={invoice.stripe_payment_url} className="text-blue-500 underline">{invoice.stripe_payment_url}</a>
            </p>
          )}
        </div>
      </div>
    );
  }
);

InvoicePreview.displayName = "InvoicePreview";
export default InvoicePreview;
