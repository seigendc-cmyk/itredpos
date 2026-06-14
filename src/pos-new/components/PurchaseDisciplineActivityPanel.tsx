import { getPurchaseDisciplineActivityEvents } from '../services/purchaseDisciplineService';

export default function PurchaseDisciplineActivityPanel() {
  const rows = getPurchaseDisciplineActivityEvents();
  return (
    <section className="creditors-panel">
      <div className="creditors-panel-header"><div><span>Activity / Audit</span><h3>Purchase discipline local audit trail</h3></div></div>
      <div className="creditors-table-wrap"><table className="creditors-table"><thead><tr><th>Time</th><th>Event</th><th>Message</th><th>Reference</th><th>Staff</th></tr></thead><tbody>{rows.map((row) => <tr key={row.eventId}><td>{new Date(row.createdAt).toLocaleString()}</td><td>{row.eventType}</td><td>{row.message}</td><td>{row.sourceReference || '-'}</td><td>{row.staffId || '-'}</td></tr>)}</tbody></table></div>
    </section>
  );
}
