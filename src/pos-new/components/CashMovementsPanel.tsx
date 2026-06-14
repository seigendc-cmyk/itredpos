import type { CashDrawerMovement } from '../types';

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

export default function CashMovementsPanel({ movements, onReview }: { movements: CashDrawerMovement[]; onReview: (movementId: string) => void }) {
  return (
    <section className="sci-pos-card cash-control-panel">
      <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Cash Movements</p><h2>Drawer Movement Ledger</h2></div><span>{movements.length} rows</span></div>
      <div className="cash-control-table-scroll">
        <table className="cash-control-table">
          <thead><tr>{['Date/Time', 'Type', 'Direction', 'Source', 'Amount', 'Payment Method', 'Reference', 'Staff', 'Reviewed', 'Action'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
          <tbody>
            {movements.map((movement) => (
              <tr key={movement.movementId}>
                <td>{new Date(movement.createdAt).toLocaleString()}</td>
                <td>{movement.type}</td>
                <td>{movement.direction}</td>
                <td>{movement.source}</td>
                <td>{money(movement.amount)}</td>
                <td>{movement.paymentMethod}</td>
                <td>{movement.referenceNumber}</td>
                <td>{movement.staffName}</td>
                <td>{movement.reviewed ? 'Reviewed' : 'Open'}</td>
                <td><button type="button" className="sci-pos-icon-button" aria-label="Review movement" onClick={() => onReview(movement.movementId)}>...</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
