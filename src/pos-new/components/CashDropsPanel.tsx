import { useState } from 'react';
import type { CashDropRecord } from '../types';

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

export default function CashDropsPanel({ drops, canCreate, onCreate }: { drops: CashDropRecord[]; canCreate: boolean; onCreate: (amount: number, handedTo: string) => void }) {
  const [amount, setAmount] = useState('');
  const [handedTo, setHandedTo] = useState('');
  return (
    <section className="sci-pos-card cash-control-panel">
      <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Cash Drops</p><h2>Safe / Bank Handover</h2></div><span>{drops.length} rows</span></div>
      <div className="cash-inline-form">
        <label>Amount<input type="number" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <label>Handed To<input value={handedTo} onChange={(event) => setHandedTo(event.target.value)} placeholder="Safe custodian" /></label>
        <button className="sci-pos-button sci-pos-button--primary" type="button" disabled={!canCreate} onClick={() => { onCreate(Number(amount), handedTo); setAmount(''); setHandedTo(''); }}>Record Cash Drop</button>
      </div>
      <div className="cash-control-table-scroll">
        <table className="cash-control-table">
          <thead><tr>{['Amount', 'Handed To', 'Received By', 'Reason', 'Status', 'Created By'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
          <tbody>{drops.map((drop) => <tr key={drop.cashDropId}><td>{money(drop.amount)}</td><td>{drop.handedTo}</td><td>{drop.receivedBy || 'Pending'}</td><td>{drop.reason}</td><td>{drop.status}</td><td>{drop.createdBy}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
