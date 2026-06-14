import { useEffect, useState } from 'react';
import type { SupplierBill } from '../types';
import { getCreditorAgeingSummary, getSupplierBills } from '../services/creditorsService';

const money = (value: number) => `$${value.toFixed(2)}`;

export default function CreditorsAgeingPanel() {
  const [search, setSearch] = useState('');
  const [bills, setBills] = useState<SupplierBill[]>([]);
  const summary = getCreditorAgeingSummary();

  useEffect(() => setBills(getSupplierBills({ search }).filter((bill) => bill.outstandingAmount > 0)), [search]);

  const cards = [
    ['Total Payables', summary.totalPayables],
    ['Current', summary.current],
    ['1-30 Days', summary.days1To30],
    ['31-60 Days', summary.days31To60],
    ['61-90 Days', summary.days61To90],
    ['91-120 Days', summary.days91To120],
    ['120+ Severe', summary.days120Plus],
    ['Due Today', summary.suppliersDueToday],
    ['Overdue Suppliers', summary.overdueSuppliers],
    ['Disputed Bills', summary.disputedBills]
  ];

  return (
    <section className="creditors-panel">
      <div className="creditors-panel-header"><div><span>Creditors Ageing</span><h3>Supplier payable buckets and overdue exposure</h3></div><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Any-order ageing search..." /></div>
      <div className="creditors-summary-grid">{cards.map(([label, value]) => <div className="creditors-summary-card" key={label}><span>{label}</span><strong>{typeof value === 'number' && label.toString().includes('Days') || label === 'Total Payables' || label === 'Current' ? money(Number(value)) : value}</strong></div>)}</div>
      <div className="creditors-table-wrap">
        <table className="creditors-table"><thead><tr><th>Supplier</th><th>Bill</th><th>Due</th><th>Outstanding</th><th>Overdue Days</th><th>Bucket</th><th>Status</th></tr></thead><tbody>{bills.map((bill) => <tr key={bill.billId}><td>{bill.supplierName}</td><td>{bill.billNumber}</td><td>{bill.dueDate}</td><td>{money(bill.outstandingAmount)}</td><td>{bill.overdueDays}</td><td>{bill.ageingBucket}</td><td>{bill.status}</td></tr>)}</tbody></table>
      </div>
    </section>
  );
}
