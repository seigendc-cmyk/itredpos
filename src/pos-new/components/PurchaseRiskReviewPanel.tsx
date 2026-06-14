import { useMemo, useState } from 'react';
import { assessPurchaseRequestRisk, getPurchaseDisciplineRequests, getPurchaseRiskAssessment } from '../services/purchaseDisciplineService';

const money = (value: number) => `$${value.toFixed(2)}`;

export default function PurchaseRiskReviewPanel() {
  const requests = getPurchaseDisciplineRequests();
  const [requestId, setRequestId] = useState(requests[0]?.requestId || '');
  const [version, setVersion] = useState(0);
  const assessment = useMemo(() => requestId ? getPurchaseRiskAssessment(requestId) : null, [requestId, version]);
  const request = requests.find((item) => item.requestId === requestId);

  return (
    <section className="creditors-panel">
      <div className="creditors-panel-header"><div><span>Purchase Risk Review</span><h3>Movement, margin, reserve, supplier, debtor and cash pressure</h3></div><button onClick={async () => { if (requestId) await assessPurchaseRequestRisk(requestId); setVersion((value) => value + 1); }}>Run Assessment</button></div>
      <div className="creditors-form-grid"><label>Request<select value={requestId} onChange={(event) => setRequestId(event.target.value)}>{requests.map((row) => <option key={row.requestId} value={row.requestId}>{row.requestNumber} - {row.productName}</option>)}</select></label></div>
      {request && <div className="creditors-notice">{request.riskNarrative}</div>}
      {assessment && <>
        <div className="creditors-summary-grid">
          <div className="creditors-summary-card"><span>Total Risk Score</span><strong>{assessment.totalRiskScore}</strong></div>
          <div className="creditors-summary-card"><span>Risk Level</span><strong>{assessment.riskLevel}</strong></div>
          <div className="creditors-summary-card"><span>Decision</span><strong>{assessment.decision}</strong></div>
          <div className="creditors-summary-card"><span>Recommended Action</span><strong>{assessment.recommendedAction}</strong></div>
        </div>
        <div className="creditors-summary-grid">
          <div className="creditors-summary-card"><span>Product Movement Risk</span><strong>{assessment.productMovementScore}</strong></div>
          <div className="creditors-summary-card"><span>Margin Risk</span><strong>{assessment.productMarginScore}</strong></div>
          <div className="creditors-summary-card"><span>COGS Reserve Risk</span><strong>{assessment.reserveRiskScore}</strong></div>
          <div className="creditors-summary-card"><span>Supplier Credit Risk</span><strong>{assessment.supplierRiskScore}</strong></div>
          <div className="creditors-summary-card"><span>Debtor Pressure</span><strong>{assessment.debtorPressureScore}</strong></div>
          <div className="creditors-summary-card"><span>Cash Pressure</span><strong>{assessment.cashPressureScore}</strong></div>
          <div className="creditors-summary-card"><span>Reserve Before</span><strong>{money(assessment.cogsReserveBefore)}</strong></div>
          <div className="creditors-summary-card"><span>Reserve After</span><strong>{money(assessment.cogsReserveAfter)}</strong></div>
        </div>
        <div className="creditors-table-wrap"><table className="creditors-table"><thead><tr><th>Warning</th></tr></thead><tbody>{assessment.warnings.map((warning) => <tr key={warning}><td>{warning}</td></tr>)}</tbody></table></div>
      </>}
    </section>
  );
}
