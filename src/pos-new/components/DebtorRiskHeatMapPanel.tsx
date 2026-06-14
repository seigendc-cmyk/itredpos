import { useEffect, useMemo, useState } from 'react';
import type { DebtorRiskHeatMapItem } from '../types';
import { blockCustomerCredit, createCollectionDiaryItem, getDebtorRiskHeatMap } from '../services/customerCreditService';

interface DebtorRiskHeatMapPanelProps {
  staffName: string;
  onOpenCustomer: (customerId: string) => void;
  onNotice: (message: string) => void;
}

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

export default function DebtorRiskHeatMapPanel({ staffName, onOpenCustomer, onNotice }: DebtorRiskHeatMapPanelProps) {
  const [rows, setRows] = useState<DebtorRiskHeatMapItem[]>([]);
  const load = async () => setRows(await getDebtorRiskHeatMap());

  useEffect(() => {
    void load();
  }, []);

  const summary = useMemo(() => ({
    top10: rows.slice(0, 10).length,
    overdue: rows.filter((row) => row.overdueAmount > 0).length,
    above80: rows.filter((row) => row.creditLimitUsagePercent >= 80).length,
    broken: rows.filter((row) => row.brokenPromiseCount > 0).length,
    disputed: rows.filter((row) => row.disputedAmount > 0).length,
    no30: rows.filter((row) => row.daysSinceLastPayment >= 30).length,
    no60: rows.filter((row) => row.daysSinceLastPayment >= 60).length,
    no90: rows.filter((row) => row.daysSinceLastPayment >= 90).length
  }), [rows]);

  const createTask = async (row: DebtorRiskHeatMapItem) => {
    await createCollectionDiaryItem({ customerId: row.customerId, customerName: row.customerName, type: 'ManagerCall', priority: row.riskLevel, dueDate: new Date().toISOString().slice(0, 10), assignedTo: 'Manager', status: 'DueToday', notes: row.recommendedAction, createdBy: staffName });
    onNotice('Collection task created from risk heat map.');
  };

  return (
    <section className="sci-pos-card debtor-control-panel">
      <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Debtor Risk</p><h2>Risk Heat Map</h2></div><span>{rows.length} customers</span></div>
      <div className="collection-diary-summary-grid">
        {[
          ['Top 10 Debtors', summary.top10],
          ['Top Overdue Customers', summary.overdue],
          ['Above 80% Credit Limit', summary.above80],
          ['Broken Promise Customers', summary.broken],
          ['Disputed Balance Customers', summary.disputed],
          ['No Payment in 30 Days', summary.no30],
          ['No Payment in 60 Days', summary.no60],
          ['No Payment in 90 Days', summary.no90]
        ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
      <div className="collection-diary-table-scroll">
        <table className="sci-pos-table collection-diary-table">
          <thead><tr>{['Customer', 'Outstanding', 'Overdue', 'Ageing', 'Limit Usage', 'Broken Promises', 'Disputed', 'Last Payment', 'Risk', 'Action'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
          <tbody>{rows.map((row) => <tr key={row.customerId}><td>{row.customerName}</td><td>{money(row.outstandingAmount)}</td><td>{money(row.overdueAmount)}</td><td>{row.ageingBucket}</td><td>{row.creditLimitUsagePercent.toFixed(0)}%</td><td>{row.brokenPromiseCount}</td><td>{money(row.disputedAmount)}</td><td>{row.daysSinceLastPayment} days</td><td>{row.riskLevel}</td><td><button onClick={() => onOpenCustomer(row.customerId)}>Open</button><button onClick={() => void createTask(row)}>Task</button><button onClick={() => void blockCustomerCredit(row.customerId, 'Blocked from risk heat map.', staffName).then(() => onNotice('Credit blocked locally.'))}>Block</button></td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
