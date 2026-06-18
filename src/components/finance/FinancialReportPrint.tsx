import { createPortal } from "react-dom";
import {
  formatCurrency,
  getNetProfit,
  getTotalExpenses,
  getProfitMargin,
  type PnLLine,
  type ReportTotals,
} from "@/lib/financialReport";

export interface ReportMeta {
  workspaceName: string;
  logoUrl?: string;
  periodLabel: string;
  generatedAt: string;
}

export interface ReportExpenseRow {
  id: string;
  title: string;
  category: string;
  date: string;
  amount: number;
  notes?: string | null;
}

export interface ReportIncomeRow {
  id: string;
  client: string;
  type: string;
  date: string;
  status: string;
  amount: number;
}

export interface ReportAgentRow {
  name: string;
  bookings: number;
  total: number;
  paid: number;
  pending: number;
}

interface Props {
  meta: ReportMeta;
  totals: ReportTotals;
  pnlLines: PnLLine[];
  expenses: ReportExpenseRow[];
  income: ReportIncomeRow[];
  agents: ReportAgentRow[];
}

const amountClass = (line: PnLLine) =>
  line.kind === "income"
    ? "fr-pos"
    : line.kind === "total"
      ? line.amount >= 0
        ? "fr-pos"
        : "fr-neg"
      : "fr-neg";

function KpiCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "pos" | "neg" }) {
  return (
    <div className="fr-kpi">
      <span className="fr-kpi-label">{label}</span>
      <span className={`fr-kpi-value ${tone === "pos" ? "fr-pos" : tone === "neg" ? "fr-neg" : ""}`}>{value}</span>
      {hint && <span className="fr-kpi-hint">{hint}</span>}
    </div>
  );
}

export default function FinancialReportPrint({ meta, totals, pnlLines, expenses, income, agents }: Props) {
  const netProfit = getNetProfit(totals);
  const totalExpenses = getTotalExpenses(totals);
  const margin = getProfitMargin(totals);

  const report = (
    <div id="financial-report-print" className="hidden" aria-hidden>
      <div className="fr-sheet">
        {/* Branded header */}
        <header className="fr-header">
          <div className="fr-brand">
            {meta.logoUrl ? (
              <img src={meta.logoUrl} alt="" className="fr-logo" />
            ) : (
              <div className="fr-logo fr-logo-fallback">{meta.workspaceName.charAt(0) || "S"}</div>
            )}
            <div>
              <div className="fr-workspace">{meta.workspaceName}</div>
              <div className="fr-title">Profit &amp; Loss Report</div>
            </div>
          </div>
          <div className="fr-meta">
            <div className="fr-meta-period">{meta.periodLabel}</div>
            <div className="fr-meta-generated">Generated {meta.generatedAt}</div>
          </div>
        </header>
        <div className="fr-rule" />

        {/* KPI summary */}
        <section className="fr-kpis">
          <KpiCard label="Total Revenue" value={formatCurrency(totals.totalRevenue)} tone="pos" />
          <KpiCard label="Total Expenses" value={formatCurrency(totalExpenses)} tone="neg" />
          <KpiCard label="Agent Commissions" value={formatCurrency(totals.totalCommissions)} />
          <KpiCard
            label="Net Profit"
            value={formatCurrency(netProfit)}
            hint={margin === null ? undefined : `${margin.toFixed(1)}% margin`}
            tone={netProfit >= 0 ? "pos" : "neg"}
          />
        </section>

        {/* P&L statement */}
        <section className="fr-section">
          <h2 className="fr-section-title">Profit &amp; Loss Statement</h2>
          <table className="fr-table">
            <thead>
              <tr>
                <th className="fr-left">Category</th>
                <th className="fr-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {pnlLines.map((line) => (
                <tr key={line.key} className={line.kind === "total" ? "fr-total-row" : undefined}>
                  <td className="fr-left">{line.label}</td>
                  <td className={`fr-right ${amountClass(line)}`}>{formatCurrency(line.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Booking income */}
        {income.length > 0 && (
          <section className="fr-section">
            <h2 className="fr-section-title">Booking Income</h2>
            <table className="fr-table">
              <thead>
                <tr>
                  <th className="fr-left">Client</th>
                  <th className="fr-left">Type</th>
                  <th className="fr-left">Date</th>
                  <th className="fr-left">Status</th>
                  <th className="fr-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {income.map((row) => (
                  <tr key={row.id}>
                    <td className="fr-left">{row.client}</td>
                    <td className="fr-left fr-cap">{row.type}</td>
                    <td className="fr-left">{row.date}</td>
                    <td className="fr-left fr-cap">{row.status}</td>
                    <td className="fr-right">{formatCurrency(row.amount)}</td>
                  </tr>
                ))}
                <tr className="fr-total-row">
                  <td className="fr-left" colSpan={4}>Total Revenue</td>
                  <td className="fr-right">{formatCurrency(totals.totalRevenue)}</td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        {/* General expenses */}
        {expenses.length > 0 && (
          <section className="fr-section">
            <h2 className="fr-section-title">General / Business Expenses</h2>
            <table className="fr-table">
              <thead>
                <tr>
                  <th className="fr-left">Title</th>
                  <th className="fr-left">Category</th>
                  <th className="fr-left">Date</th>
                  <th className="fr-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((row) => (
                  <tr key={row.id}>
                    <td className="fr-left">
                      {row.title}
                      {row.notes ? <span className="fr-note"> — {row.notes}</span> : null}
                    </td>
                    <td className="fr-left fr-cap">{row.category}</td>
                    <td className="fr-left">{row.date}</td>
                    <td className="fr-right">{formatCurrency(row.amount)}</td>
                  </tr>
                ))}
                <tr className="fr-total-row">
                  <td className="fr-left" colSpan={3}>Total</td>
                  <td className="fr-right">{formatCurrency(totals.totalWorkspaceExpenses)}</td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        {/* Agent commissions */}
        {agents.length > 0 && (
          <section className="fr-section">
            <h2 className="fr-section-title">Agent Commissions</h2>
            <table className="fr-table">
              <thead>
                <tr>
                  <th className="fr-left">Agent</th>
                  <th className="fr-center">Bookings</th>
                  <th className="fr-right">Total</th>
                  <th className="fr-right">Paid</th>
                  <th className="fr-right">Pending</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((row) => (
                  <tr key={row.name}>
                    <td className="fr-left">{row.name}</td>
                    <td className="fr-center">{row.bookings}</td>
                    <td className="fr-right">{formatCurrency(row.total)}</td>
                    <td className="fr-right fr-pos">{formatCurrency(row.paid)}</td>
                    <td className="fr-right fr-warn">{formatCurrency(row.pending)}</td>
                  </tr>
                ))}
                <tr className="fr-total-row">
                  <td className="fr-left">Total</td>
                  <td className="fr-center">{agents.reduce((s, a) => s + a.bookings, 0)}</td>
                  <td className="fr-right">{formatCurrency(totals.totalCommissions)}</td>
                  <td className="fr-right fr-pos">{formatCurrency(agents.reduce((s, a) => s + a.paid, 0))}</td>
                  <td className="fr-right fr-warn">{formatCurrency(agents.reduce((s, a) => s + a.pending, 0))}</td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        <footer className="fr-footer">
          {meta.workspaceName} · Profit &amp; Loss Report · {meta.periodLabel} · Generated by SimchaSync
        </footer>
      </div>
    </div>
  );

  return createPortal(report, document.body);
}
