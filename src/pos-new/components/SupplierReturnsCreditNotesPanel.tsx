import { useEffect, useState } from 'react';
import type { SupplierReturn } from '../types';
import { getSupplierReturns, getSupplierReturnSummary } from '../services/supplierReturnService';

const money = (value: number) => `$${value.toFixed(2)}`;

export default function SupplierReturnsCreditNotesPanel() {
  const [returns, setReturns] = useState<SupplierReturn[]>([]);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getSupplierReturnSummary>> | null>(null);
  useEffect(() => { void getSupplierReturns().then(setReturns); void getSupplierReturnSummary().then(setSummary); }, []);

  return (
    <section className="creditors-panel">
      <div className="creditors-panel-header"><div><span>Supplier Returns / Credit Notes</span><h3>Supplier return records and credit note placeholders</h3></div></div>
      {summary && <div className="creditors-summary-grid">
        <div className="creditors-summary-card"><span>Pending Credit Notes</span><strong>{summary.creditNotesPending}</strong></div>
        <div className="creditors-summary-card"><span>Posted Returns</span><strong>{summary.postedReturns}</strong></div>
        <div className="creditors-summary-card"><span>Return Value Estimate</span><strong>{money(summary.returnValueEstimate)}</strong></div>
      </div>}
      <div className="creditors-table-wrap">
        <table className="creditors-table"><thead><tr><th>Return</th><th>Supplier</th><th>GRN</th><th>Status</th><th>Resolution</th><th>Credit Note</th><th>Value</th></tr></thead><tbody>{returns.map((record) => <tr key={record.supplierReturnId}><td>{record.supplierReturnNumber}</td><td>{record.supplierName}</td><td>{record.grnNumber}</td><td>{record.status}</td><td>{record.resolution}</td><td>{record.supplierCreditNoteNumber || 'Pending'}</td><td>{money(record.totalReturnValue || 0)}</td></tr>)}</tbody></table>
      </div>
    </section>
  );
}
