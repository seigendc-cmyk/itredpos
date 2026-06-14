import { useState } from 'react';
import { createReserveAdjustment, flagReserveLeakage, getCOGSReserveMovements, getCOGSReserveSummary } from '../services/cogsReserveService';

const money = (value: number) => `$${value.toFixed(2)}`;

export default function COGSReservePanel() {
  const [version, setVersion] = useState(0);
  const summary = getCOGSReserveSummary();
  const movements = getCOGSReserveMovements();
  const refresh = () => setVersion((value) => value + 1);
  void version;
  const cards = [
    ['Opening Reserve', summary.openingReserve],
    ['COGS Recovered From Sales', summary.recoveredFromSales],
    ['Used For Supplier Payments', summary.usedForSupplierPayments],
    ['Used For Cash Stock Purchases', summary.usedForCashStockPurchases],
    ['Adjustments', summary.adjustments],
    ['Reserve Leakage', summary.leakage],
    ['Current Reserve Balance', summary.currentReserveBalance],
    ['Required Reserve Level', summary.requiredReserveLevel],
    ['Reserve Shortfall', summary.reserveShortfall],
    ['Reserve Coverage %', `${summary.reserveCoveragePercent}%`],
    ['Reserve Status', summary.reserveStatus]
  ];

  return (
    <section className="creditors-panel">
      <div className="creditors-panel-header"><div><span>COGS Reserve</span><h3>Management-control reserve for stock replacement money</h3></div><div className="creditors-toolbar"><button onClick={async () => { await createReserveAdjustment({ amount: 100, direction: 'In', reference: 'OPENING-ADJ', reason: 'Build 19AO opening reserve adjustment.', staffId: 'Owner', staffName: 'Owner' }); refresh(); }}>Add Opening Reserve</button><button onClick={async () => { await flagReserveLeakage({ amount: 50, reference: 'LEAKAGE-REVIEW', reason: 'Build 19AO reserve leakage review.', staffId: 'Manager', staffName: 'Manager' }); refresh(); }}>Flag Leakage</button></div></div>
      <p className="creditors-explainer">COGS Reserve is a management-control reserve for stock replacement. It is not final accounting posting and it is not the same as physical drawer cash.</p>
      <div className="creditors-summary-grid">{cards.map(([label, value]) => <div className="creditors-summary-card" key={label}><span>{label}</span><strong>{typeof value === 'number' ? money(value) : value}</strong></div>)}</div>
      <div className="creditors-table-wrap">
        <table className="creditors-table"><thead><tr><th>Date</th><th>Type</th><th>Direction</th><th>Amount</th><th>Source</th><th>Reference</th><th>Supplier</th><th>Balance After</th><th>Protected</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.movementId}><td>{movement.movementDate}</td><td>{movement.type}</td><td>{movement.direction}</td><td>{money(movement.amount)}</td><td>{movement.sourceReferenceType}</td><td>{movement.sourceReferenceNumber}</td><td>{movement.supplierName || '-'}</td><td>{money(movement.reserveBalanceAfter)}</td><td>{movement.protected ? 'Yes' : 'No'}</td></tr>)}</tbody></table>
      </div>
    </section>
  );
}
