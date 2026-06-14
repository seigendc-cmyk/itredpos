import { useMemo, useState } from 'react';
import type { CashControlSummary, CashDrawerReconciliation } from '../types';

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

export default function DrawerReconciliationPanel({
  summary,
  reconciliation,
  staffName,
  canApprove,
  onCreate,
  onApprove,
  onReject
}: {
  summary: CashControlSummary | null;
  reconciliation: CashDrawerReconciliation | null;
  staffName: string;
  canApprove: boolean;
  onCreate: (countedCash: number, notes: string, status: CashDrawerReconciliation['status']) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const [countedCash, setCountedCash] = useState(String(summary?.countedCash || summary?.expectedCash || 0));
  const [notes, setNotes] = useState('');
  const counted = Math.max(0, Number(countedCash) || 0);
  const expected = summary?.expectedCash || 0;
  const variance = useMemo(() => counted - expected, [counted, expected]);
  return (
    <section className="sci-pos-card cash-control-panel">
      <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Drawer Reconciliation</p><h2>Expected Cash Calculation</h2></div><span>{reconciliation?.status || 'Draft'}</span></div>
      <div className="cash-recon-grid">
        <div><span>Opening Float</span><strong>{money(summary?.openingFloat || 0)}</strong></div>
        <div><span>Cash Sales</span><strong>{money(summary?.cashSales || 0)}</strong></div>
        <div><span>Cash Debtor Payments</span><strong>{money(summary?.cashDebtorPayments || 0)}</strong></div>
        <div><span>Delivery Handovers</span><strong>{money(summary?.deliveryCashHandovers || 0)}</strong></div>
        <div><span>Refunds / Expenses / Drops</span><strong>{money((summary?.cashRefunds || 0) + (summary?.drawerExpenses || 0) + (summary?.cashDrops || 0))}</strong></div>
        <div><span>Expected Cash</span><strong>{money(expected)}</strong></div>
        <label>Counted Cash<input type="number" min="0" value={countedCash} onChange={(event) => setCountedCash(event.target.value)} /></label>
        <label>Notes<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={`Prepared by ${staffName}`} /></label>
        <div><span>Variance</span><strong>{money(variance)}</strong></div>
      </div>
      <div className="cash-control-actions">
        <button className="sci-pos-button sci-pos-button--secondary" type="button" onClick={() => onCreate(counted, notes || 'Saved draft.', 'Draft')}>Save Draft</button>
        <button className="sci-pos-button sci-pos-button--primary" type="button" onClick={() => onCreate(counted, notes || 'Submitted for review.', variance === 0 ? 'Balanced' : 'PendingReview')}>Submit for Review</button>
        {reconciliation && <button className="sci-pos-button sci-pos-button--secondary" disabled={!canApprove} type="button" onClick={() => onApprove(reconciliation.reconciliationId)}>Approve</button>}
        {reconciliation && <button className="sci-pos-button sci-pos-button--secondary" disabled={!canApprove} type="button" onClick={() => onReject(reconciliation.reconciliationId)}>Reject</button>}
        <button className="sci-pos-button sci-pos-button--secondary" type="button" onClick={() => window.print()}>Print Cash Summary</button>
      </div>
    </section>
  );
}
