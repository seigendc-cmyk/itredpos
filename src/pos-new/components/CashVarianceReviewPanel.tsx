import type { CashVarianceRecord } from '../types';

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

export default function CashVarianceReviewPanel({ variances, onCreateBI }: { variances: CashVarianceRecord[]; onCreateBI: (variance: CashVarianceRecord) => void }) {
  return (
    <section className="sci-pos-card cash-control-panel">
      <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Variance Review</p><h2>Cash Differences</h2></div><span>{variances.length} rows</span></div>
      <div className="cash-control-table-scroll">
        <table className="cash-control-table">
          <thead><tr>{['Shift', 'Drawer', 'Expected', 'Counted', 'Variance', 'Type', 'Staff', 'Status', 'Review Notes', 'Action'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
          <tbody>
            {variances.map((variance) => (
              <tr key={variance.varianceId}>
                <td>{variance.shiftId}</td>
                <td>{variance.drawerId}</td>
                <td>{money(variance.expectedCash)}</td>
                <td>{money(variance.countedCash)}</td>
                <td>{money(variance.variance)}</td>
                <td>{variance.varianceType}</td>
                <td>{variance.staffName}</td>
                <td>{variance.status}</td>
                <td>{variance.reviewNotes}</td>
                <td><button type="button" className="sci-pos-icon-button" aria-label="Create BI advice" onClick={() => onCreateBI(variance)}>...</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
