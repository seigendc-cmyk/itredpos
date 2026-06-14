import { useState } from 'react';
import { calculateCOGSReservePressure, getCOGSBuyingCapacitySummary } from '../services/purchaseDisciplineService';

const money = (value: number) => `$${value.toFixed(2)}`;

export default function COGSBuyingControlPanel() {
  const [amount, setAmount] = useState('250');
  const summary = getCOGSBuyingCapacitySummary();
  const impact = calculateCOGSReservePressure(Math.max(0, Number(amount) || 0));
  const cards = [
    ['Current COGS Reserve', summary.currentReserveBalance],
    ['Required Reserve Level', summary.requiredReserveLevel],
    ['Available For Reorder', summary.availableForReorder],
    ['Pending Purchase Commitments', summary.pendingPurchaseCommitments],
    ['Supplier Bills Due', summary.supplierBillsDue],
    ['Reserve Shortfall', summary.reserveShortfall],
    ['Reserve Coverage %', `${summary.reserveCoveragePercent}%`],
    ['Safe Buying Capacity', summary.safeBuyingCapacity],
    ['Reserve Status', summary.reserveStatus]
  ];
  return (
    <section className="creditors-panel">
      <div className="creditors-panel-header"><div><span>COGS Buying Control</span><h3>Protected stock-seed buying capacity</h3></div><button onClick={() => window.print()}>Print Summary</button></div>
      <p className="creditors-explainer">Do not use COGS Reserve for expenses, drawings, or non-stock leakage without Owner approval. Stock seed is protected for replenishment.</p>
      <div className="creditors-summary-grid">{cards.map(([label, value]) => <div className="creditors-summary-card" key={label}><span>{label}</span><strong>{typeof value === 'number' ? money(value) : value}</strong></div>)}</div>
      <div className="creditors-form-grid"><label>Estimated Purchase Amount<input value={amount} onChange={(event) => setAmount(event.target.value)} /></label></div>
      <div className="creditors-summary-grid">
        <div className="creditors-summary-card"><span>Reserve Before</span><strong>{money(impact.before)}</strong></div>
        <div className="creditors-summary-card"><span>Reserve Required</span><strong>{money(impact.required)}</strong></div>
        <div className="creditors-summary-card"><span>Reserve After</span><strong>{money(impact.after)}</strong></div>
        <div className="creditors-summary-card"><span>Coverage After</span><strong>{impact.coverage}%</strong></div>
        <div className="creditors-summary-card"><span>Recommendation</span><strong>{impact.after < 0 || impact.coverage < 50 ? 'Require approval before buying' : impact.coverage < 80 ? 'Warn before purchase' : 'Capacity acceptable'}</strong></div>
      </div>
    </section>
  );
}
