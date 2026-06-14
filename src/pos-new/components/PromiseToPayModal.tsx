import { useEffect, useState } from 'react';
import type { CustomerDebtRecord, CustomerRecord, PromiseToPayMethod, PromiseToPayRecord } from '../types';
import { createPromiseToPay, getPromisesToPay, markPromiseBroken, markPromiseKept, reschedulePromiseToPay } from '../services/customerCreditService';

interface PromiseToPayModalProps {
  open: boolean;
  customer: CustomerRecord | null;
  debt?: CustomerDebtRecord | null;
  staffName: string;
  defaultAmount?: number;
  onClose: () => void;
  onNotice: (message: string) => void;
  onSaved: () => void;
}

const methods: PromiseToPayMethod[] = ['PhoneCall', 'WhatsApp', 'CustomerVisit', 'Email', 'InPerson', 'Other'];

export default function PromiseToPayModal({ open, customer, debt, staffName, defaultAmount, onClose, onNotice, onSaved }: PromiseToPayModalProps) {
  const [rows, setRows] = useState<PromiseToPayRecord[]>([]);
  const [amount, setAmount] = useState(defaultAmount || debt?.outstandingAmount || 0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PromiseToPayMethod>('PhoneCall');
  const [assignedTo, setAssignedTo] = useState('Manager');
  const [note, setNote] = useState('');

  const load = () => setRows(customer ? getPromisesToPay({ customerId: customer.customerId }) : []);

  useEffect(() => {
    if (open) {
      setAmount(defaultAmount || debt?.outstandingAmount || 0);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer?.customerId, debt?.debtId, defaultAmount]);

  if (!open || !customer) return null;

  const save = async () => {
    await createPromiseToPay({
      customerId: customer.customerId,
      customerName: customer.customerName,
      debtId: debt?.debtId,
      debtReference: debt?.receiptNumber,
      promisedAmount: amount,
      promisedDate: date,
      promiseMethod: method,
      capturedBy: staffName,
      followUpNote: note || 'Promise-to-pay captured locally.',
      assignedTo
    });
    onNotice('Promise-to-pay saved locally.');
    load();
    onSaved();
  };

  const update = async (promise: PromiseToPayRecord, action: 'Kept' | 'Broken' | 'Reschedule') => {
    if (action === 'Kept') await markPromiseKept(promise.promiseId);
    if (action === 'Broken') await markPromiseBroken(promise.promiseId, note || 'Payment not received by promised date.');
    if (action === 'Reschedule') await reschedulePromiseToPay(promise.promiseId, date, note || 'Promise rescheduled locally.');
    onNotice(`Promise marked ${action.toLowerCase()} locally.`);
    load();
    onSaved();
  };

  return (
    <div className="pos-modal-backdrop" role="presentation">
      <section className="pos-credit-workflow-modal" role="dialog" aria-modal="true" aria-labelledby="promise-title">
        <div className="pos-new-customer-modal__header">
          <div><p className="sci-pos-eyebrow">Promise to Pay</p><h2 id="promise-title">{customer.customerName}</h2></div>
          <button type="button" className="sci-pos-icon-button" onClick={onClose} aria-label="Close promise modal">X</button>
        </div>
        <div className="pos-credit-config-grid">
          <label>Promised Amount<input type="number" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label>
          <label>Promised Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <label>Method<select value={method} onChange={(event) => setMethod(event.target.value as PromiseToPayMethod)}>{methods.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Assigned Staff<input value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} /></label>
          <label className="pos-credit-config-grid__wide">Follow-up Note<textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></label>
        </div>
        <div className="collection-diary-table-scroll">
          <table className="sci-pos-table collection-diary-table">
            <thead><tr><th>Date</th><th>Reference</th><th>Amount</th><th>Method</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {rows.map((row) => <tr key={row.promiseId}><td>{row.promisedDate}</td><td>{row.debtReference || 'Customer'}</td><td>USD {row.promisedAmount.toFixed(2)}</td><td>{row.promiseMethod}</td><td>{row.status}</td><td><button type="button" onClick={() => void update(row, 'Kept')}>Kept</button><button type="button" onClick={() => void update(row, 'Broken')}>Broken</button><button type="button" onClick={() => void update(row, 'Reschedule')}>Reschedule</button></td></tr>)}
              {rows.length === 0 && <tr><td colSpan={6}>No promises captured.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="pos-new-customer-modal__actions">
          <button type="button" className="pos-action-button pos-action-button-primary" onClick={save}>Save Promise</button>
        </div>
      </section>
    </div>
  );
}
