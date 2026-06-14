import { useEffect, useState } from 'react';
import type { BIAdviceRecord } from '../types';
import { getBIAdviceRecords } from '../services/biAdviceService';
import { createPurchaseDisciplineWarnings } from '../services/purchaseDisciplineService';

export default function PurchaseBIWarningsPanel() {
  const [rows, setRows] = useState<BIAdviceRecord[]>([]);
  const [notice, setNotice] = useState('');
  const load = async () => setRows(await getBIAdviceRecords({ category: 'Supplier / Purchase Discipline' }));
  useEffect(() => { void load(); }, []);
  return (
    <section className="creditors-panel">
      <div className="creditors-panel-header"><div><span>Purchase BI Warnings</span><h3>Purchase discipline, reserve, supplier and reorder risk advice</h3></div><button onClick={async () => { await createPurchaseDisciplineWarnings(); setNotice('Purchase discipline BI warnings generated locally.'); await load(); }}>Generate Warnings</button></div>
      {notice && <div className="creditors-notice">{notice}</div>}
      <div className="creditors-table-wrap"><table className="creditors-table"><thead><tr><th>Advice</th><th>Priority</th><th>Narrative</th><th>Recommended Action</th><th>Desk</th><th>Role</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row.adviceId}><td>{row.title}</td><td>{row.priority}</td><td>{row.narrative}</td><td>{row.recommendedAction}</td><td>{row.assignedDesk}</td><td>{row.assignedToRole}</td><td>{row.status}</td></tr>)}</tbody></table></div>
    </section>
  );
}
