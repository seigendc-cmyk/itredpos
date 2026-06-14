import type { CustomerDebtPayment, DebtorPaymentCashLink } from '../types';

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

export default function DebtorPaymentsCashPanel({ payments, links, onLink }: { payments: CustomerDebtPayment[]; links: DebtorPaymentCashLink[]; onLink: (paymentId: string) => void }) {
  return (
    <section className="sci-pos-card cash-control-panel">
      <div className="sci-pos-card__bar"><div><p className="sci-pos-eyebrow">Debtor Payments</p><h2>Drawer Impact</h2></div><span>{payments.length} payments</span></div>
      <div className="cash-control-table-scroll">
        <table className="cash-control-table">
          <thead><tr>{['Debt / Receipt', 'Payment Date', 'Method', 'Amount', 'Received By', 'Drawer Impact', 'Linked Drawer', 'EOD Status', 'Action'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
          <tbody>
            {payments.map((payment) => {
              const link = links.find((row) => row.paymentId === payment.paymentId);
              const drawerImpact = payment.paymentMethod === 'Cash' ? 'Increases drawer cash' : 'Received non-cash';
              return (
                <tr key={payment.paymentId}>
                  <td>{payment.debtId}</td>
                  <td>{new Date(payment.receivedAt).toLocaleString()}</td>
                  <td>{payment.paymentMethod}</td>
                  <td>{money(payment.amount)}</td>
                  <td>{payment.receivedByStaffId}</td>
                  <td>{drawerImpact}</td>
                  <td>{link?.drawerId || payment.shiftId || 'Not linked'}</td>
                  <td>{link || payment.paymentMethod !== 'Cash' ? 'Ready' : 'Warning'}</td>
                  <td><button type="button" className="sci-pos-icon-button" aria-label="Link debtor payment" onClick={() => onLink(payment.paymentId)}>...</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
