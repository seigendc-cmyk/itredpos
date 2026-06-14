import type { DeliveryCashHandoverRecord } from '../types';

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

export default function DeliveryCashHandoverPanel({ handovers, onConfirm }: { handovers: DeliveryCashHandoverRecord[]; onConfirm: (handoverId: string) => void }) {
  return (
    <section className="sci-pos-card cash-control-panel">
      <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Delivery Cash</p><h2>Handovers</h2></div><span>{handovers.length} rows</span></div>
      <div className="cash-control-table-scroll">
        <table className="cash-control-table">
          <thead><tr>{['Delivery ID', 'Customer', 'Driver', 'Cash Expected', 'Cash Received', 'Difference', 'Status', 'Received By', 'Time', 'Action'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
          <tbody>
            {handovers.map((handover) => (
              <tr key={handover.handoverId}>
                <td>{handover.deliveryId}</td>
                <td>{handover.customerName}</td>
                <td>{handover.driverName}</td>
                <td>{money(handover.cashExpected)}</td>
                <td>{money(handover.cashReceived)}</td>
                <td>{money(handover.difference)}</td>
                <td>{handover.handoverStatus}</td>
                <td>{handover.receivedBy || '-'}</td>
                <td>{new Date(handover.createdAt).toLocaleString()}</td>
                <td><button type="button" className="sci-pos-icon-button" aria-label="Confirm handover" onClick={() => onConfirm(handover.handoverId)}>...</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
