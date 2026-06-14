import { X } from 'lucide-react';
import { useState } from 'react';
import type { CustomerDebtRecord } from '../types';

interface RecordDebtPaymentModalProps {
  debt: CustomerDebtRecord | null;
  receivedBy: string;
  onClose: () => void;
  onRecord: (payload: {
    debtId: string;
    customerId: string;
    amount: number;
    paymentMethod: string;
    reference: string;
    notes: string;
    receivedByStaffId: string;
    branchId?: string;
    shiftId?: string;
  }) => Promise<void> | void;
}

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

export default function RecordDebtPaymentModal({ debt, receivedBy, onClose, onRecord }: RecordDebtPaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [allocationMode, setAllocationMode] = useState('Selected Debt Only');
  const [error, setError] = useState('');

  if (!debt) return null;

  const submit = async () => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Payment amount must be above zero.');
      return;
    }
    if (numericAmount > debt.outstandingAmount) {
      setError('Payment cannot exceed outstanding amount.');
      return;
    }
    await onRecord({
      debtId: debt.debtId,
      customerId: debt.customerId,
      amount: numericAmount,
      paymentMethod,
      reference,
      notes,
      receivedByStaffId: receivedBy,
      branchId: debt.branchId,
      shiftId: debt.shiftId
    });
    clearForm();
  };

  const clearForm = () => {
    setAmount('');
    setPaymentMethod('Cash');
    setReference('');
    setNotes('');
    setReceivedDate(new Date().toISOString().slice(0, 10));
    setAllocationMode('Selected Debt Only');
    setError('');
  };

  return (
    <div className="pos-modal-backdrop" role="presentation">
      <section className="pos-record-debt-modal" role="dialog" aria-modal="true" aria-labelledby="record-debt-payment-title">
        <div className="pos-new-customer-modal__header">
          <div>
            <p className="sci-pos-eyebrow">Customer Credit</p>
            <h2 id="record-debt-payment-title">Record Debt Payment</h2>
          </div>
          <button type="button" className="sci-pos-icon-button" aria-label="Close debt payment modal" onClick={onClose}><X size={18} /></button>
        </div>
        {error && <div className="sci-pos-alert" role="alert">{error}</div>}
        <div className="pos-record-debt-grid">
          <div><span>Customer</span><strong>{debt.customerName}</strong></div>
          <div><span>Debt / Receipt</span><strong>{debt.receiptNumber}</strong></div>
          <div><span>Outstanding Amount</span><strong>{money(debt.outstandingAmount)}</strong></div>
          <div><span>Received By</span><strong>{receivedBy}</strong></div>
        </div>
        <div className="pos-record-debt-form">
          <label>Payment Amount<input type="number" min="0" max={debt.outstandingAmount} value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
          <label>Payment Method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option>Cash</option><option>EcoCash Placeholder</option><option>Innbucks Placeholder</option><option>Mukuru Placeholder</option><option>ZIPIT Placeholder</option><option>Bank Transfer</option><option>Card Placeholder</option></select></label>
          <label>Reference / Confirmation Code<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Receipt, bank, or mobile reference" /></label>
          <label>Received Date<input type="date" value={receivedDate} onChange={(event) => setReceivedDate(event.target.value)} /></label>
          <label>Allocate Payment<select value={allocationMode} onChange={(event) => setAllocationMode(event.target.value)}><option>Selected Debt Only</option><option>Oldest Debt First</option><option>Manual Allocation Placeholder</option></select></label>
          <label>Payment Notes<textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={`Allocation: ${allocationMode}. Received date: ${receivedDate}.`} /></label>
        </div>
        <div className="pos-new-customer-modal__actions">
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={clearForm}>Clear</button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => void submit()}>Record Payment</button>
        </div>
      </section>
    </div>
  );
}
