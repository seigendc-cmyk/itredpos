import { X } from 'lucide-react';
import type { CustomerCreditProfile, CustomerCreditWorthinessScore } from '../types';
import type { CustomerDebtLedgerRow } from '../services/customerCreditService';

interface CustomerDebtLedgerModalProps {
  open: boolean;
  customerName: string;
  profile: CustomerCreditProfile | null;
  worthiness: CustomerCreditWorthinessScore | null;
  rows: CustomerDebtLedgerRow[];
  onRecordPayment: () => void;
  onPrintStatement: () => void;
  onSendReminder: () => void;
  onCreateTask: () => void;
  onClose: () => void;
}

function money(value?: number): string {
  return `USD ${(value || 0).toFixed(2)}`;
}

export default function CustomerDebtLedgerModal({
  open,
  customerName,
  profile,
  worthiness,
  rows,
  onRecordPayment,
  onPrintStatement,
  onSendReminder,
  onCreateTask,
  onClose
}: CustomerDebtLedgerModalProps) {
  if (!open) return null;
  return (
    <div className="pos-modal-backdrop" role="presentation">
      <section className="pos-debt-ledger-modal" role="dialog" aria-modal="true" aria-labelledby="customer-debt-ledger-title">
        <div className="pos-new-customer-modal__header">
          <div><p className="sci-pos-eyebrow">Debtors Control</p><h2 id="customer-debt-ledger-title">Customer Debt Ledger</h2></div>
          <button type="button" className="sci-pos-icon-button" aria-label="Close debt ledger" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="pos-credit-profile-grid">
          {[
            ['Customer', customerName],
            ['Credit Status', profile?.creditStatus || 'None'],
            ['Credit Limit', money(profile?.creditLimit)],
            ['Current Balance', money(profile?.currentBalance)],
            ['Available Credit', money(profile?.availableCredit)],
            ['Overdue Balance', money(profile?.overdueBalance)],
            ['Average Days to Pay', String(worthiness?.averageDaysToPay || 0)],
            ['Credit Worthiness Grade', worthiness?.grade || 'Fair']
          ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
        </div>
        <div className="pos-credit-debt-scroll">
          <table className="sci-pos-table pos-credit-debt-table">
            <thead><tr>{['Date', 'Type', 'Reference', 'Debit', 'Credit', 'Balance', 'Staff', 'Notes'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.date).toLocaleDateString()}</td>
                  <td>{row.type}</td>
                  <td>{row.reference}</td>
                  <td>{money(row.debit)}</td>
                  <td>{money(row.credit)}</td>
                  <td>{money(row.balance)}</td>
                  <td>{row.staff}</td>
                  <td>{row.notes}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} className="pos-customer-empty-cell">No ledger rows found.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="pos-new-customer-modal__actions">
          <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={onRecordPayment}>Record Payment</button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onPrintStatement}>Print Statement</button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onSendReminder}>Send Reminder</button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onCreateTask}>Create Task</button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onClose}>Close</button>
        </div>
      </section>
    </div>
  );
}
