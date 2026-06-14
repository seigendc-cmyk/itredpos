import { useState } from 'react';
import type { SupplierStatementRecord } from '../types';
import { generateSupplierStatement, getSupplierCreditProfiles, getSupplierStatementHistory } from '../services/creditorsService';
import SupplierStatementDocument from './SupplierStatementDocument';

export default function SupplierStatementsPanel() {
  const suppliers = getSupplierCreditProfiles();
  const [supplierId, setSupplierId] = useState(suppliers[0]?.supplierId || '');
  const [periodFrom, setPeriodFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [periodTo, setPeriodTo] = useState(new Date().toISOString().slice(0, 10));
  const [statement, setStatement] = useState<SupplierStatementRecord | null>(null);
  const history = getSupplierStatementHistory({ supplierId });

  const generate = async () => setStatement(await generateSupplierStatement(supplierId, periodFrom, periodTo, 'Accountant'));

  return (
    <section className="creditors-panel">
      <div className="creditors-panel-header"><div><span>Supplier Statements</span><h3>Supplier account statement generation and print</h3></div><button onClick={() => window.print()}>Print / Save PDF</button></div>
      <div className="creditors-form-grid">
        <label>Supplier<select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>{suppliers.map((supplier) => <option key={supplier.supplierId} value={supplier.supplierId}>{supplier.supplierName}</option>)}</select></label>
        <label>From<input type="date" value={periodFrom} onChange={(event) => setPeriodFrom(event.target.value)} /></label>
        <label>To<input type="date" value={periodTo} onChange={(event) => setPeriodTo(event.target.value)} /></label>
        <button className="creditors-primary" onClick={generate}>Generate Statement</button>
      </div>
      {statement && <SupplierStatementDocument statement={statement} />}
      <div className="creditors-table-wrap">
        <table className="creditors-table"><thead><tr><th>Generated</th><th>Supplier</th><th>Period</th><th>Closing Balance</th></tr></thead><tbody>{history.map((row) => <tr key={row.statementId}><td>{new Date(row.generatedAt).toLocaleString()}</td><td>{row.supplierName}</td><td>{row.periodFrom} to {row.periodTo}</td><td>${row.closingBalance.toFixed(2)}</td></tr>)}</tbody></table>
      </div>
    </section>
  );
}
