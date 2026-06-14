import type { CashControlSummary } from '../types';

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

export default function CashControlDashboardPanel({ summary }: { summary: CashControlSummary | null }) {
  const rows = [
    ['Opening Float', summary?.openingFloat || 0],
    ['Cash Sales', summary?.cashSales || 0],
    ['Cash Debtor Payments', summary?.cashDebtorPayments || 0],
    ['Delivery Cash Handovers', summary?.deliveryCashHandovers || 0],
    ['Cash Refunds', summary?.cashRefunds || 0],
    ['Drawer Expenses', summary?.drawerExpenses || 0],
    ['Supplier Cash Payments', summary?.supplierCashPayments || 0],
    ['Cash Drops', summary?.cashDrops || 0],
    ['Expected Cash', summary?.expectedCash || 0],
    ['Counted Cash', summary?.countedCash || 0],
    ['Variance', summary?.variance || 0],
    ['Pending Review', summary?.pendingReview || 0],
    ['High Risk Alerts', summary?.highRiskAlerts || 0]
  ];
  return (
    <section className="cash-control-grid">
      {rows.map(([label, value]) => (
        <article className="cash-control-card" key={label}>
          <span>{label}</span>
          <strong>{typeof value === 'number' && !String(label).includes('Review') && !String(label).includes('Alerts') ? money(value) : value}</strong>
        </article>
      ))}
    </section>
  );
}
