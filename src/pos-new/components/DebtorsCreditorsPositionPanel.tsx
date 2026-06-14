import { useEffect, useState } from 'react';
import type { FinancialPositionSummary } from '../types';
import { getFinancialPositionSummary } from '../services/financialControlService';

const money = (value: number) => `$${value.toFixed(2)}`;

export default function DebtorsCreditorsPositionPanel() {
  const [summary, setSummary] = useState<FinancialPositionSummary | null>(null);

  useEffect(() => {
    void getFinancialPositionSummary().then(setSummary);
  }, []);

  if (!summary) return <div className="p-4 text-xs text-slate-500">Loading debtor and creditor position...</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <PositionCard title="Debtors Position" rows={[
        ['Outstanding debtors', money(summary.debtorsOutstanding)],
        ['Collection expectation', money(1550)],
        ['Risky inflow bucket', money(650)],
        ['Management note', 'Collections improve CashPlan before supplier approvals.']
      ]} />
      <PositionCard title="Creditors Position" rows={[
        ['Outstanding creditors', money(summary.creditorsOutstanding)],
        ['Committed supplier payments', money(summary.lessCommittedSupplierPayments)],
        ['Purchase commitments', money(summary.purchaseCommitments)],
        ['Management note', 'Payments should be approved from free usable cash only.']
      ]} />
    </div>
  );
}

function PositionCard({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <div className="bg-white border border-slate-200 p-4">
      <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">{title}</h3>
      <dl className="mt-4 space-y-2 text-xs">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 border-b border-slate-100 pb-2">
            <dt className="text-slate-500">{label}</dt>
            <dd className="font-bold text-slate-800 text-right">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
