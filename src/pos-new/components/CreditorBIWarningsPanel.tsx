import { useEffect, useState } from 'react';
import type { CreditorRiskItem } from '../types';
import { createCreditorBIWarnings, getCreditorRiskHeatMap } from '../services/creditorsService';

const money = (value: number) => `$${value.toFixed(2)}`;

export default function CreditorBIWarningsPanel() {
  const [items, setItems] = useState<CreditorRiskItem[]>([]);
  const [notice, setNotice] = useState('');

  const load = () => setItems(getCreditorRiskHeatMap());
  useEffect(load, []);

  return (
    <section className="creditors-panel">
      <div className="creditors-panel-header"><div><span>Creditor BI Warnings</span><h3>Supplier risk, reserve pressure and purchase discipline triggers</h3></div><button onClick={async () => { await createCreditorBIWarnings(); setNotice('Creditor BI warning placeholders generated locally.'); load(); }}>Generate BI Warnings</button></div>
      {notice && <div className="creditors-notice">{notice}</div>}
      <div className="creditors-table-wrap">
        <table className="creditors-table"><thead><tr><th>Supplier</th><th>Outstanding</th><th>Overdue</th><th>Ageing</th><th>Limit Usage</th><th>Last Payment Age</th><th>Disputed</th><th>Risk</th><th>Recommended Action</th></tr></thead><tbody>{items.map((item) => <tr key={item.supplierId}><td>{item.supplierName}</td><td>{money(item.outstandingAmount)}</td><td>{money(item.overdueAmount)}</td><td>{item.ageingBucket}</td><td>{item.supplierCreditLimitUsagePercent}%</td><td>{item.daysSinceLastPayment} days</td><td>{money(item.disputedAmount)}</td><td>{item.riskLevel}</td><td>{item.recommendedAction}</td></tr>)}</tbody></table>
      </div>
    </section>
  );
}
