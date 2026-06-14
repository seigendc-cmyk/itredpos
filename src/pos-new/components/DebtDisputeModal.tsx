import { useEffect, useState } from 'react';
import type { CustomerDebtRecord, CustomerRecord, DebtDisputeRecord, DebtDisputeStatus } from '../types';
import { createDebtDispute, getDebtDisputes, resolveDebtDispute, updateDebtDisputeStatus } from '../services/customerCreditService';

interface DebtDisputeModalProps {
  open: boolean;
  customer: CustomerRecord | null;
  debt?: CustomerDebtRecord | null;
  staffName: string;
  onClose: () => void;
  onNotice: (message: string) => void;
  onSaved: () => void;
}

export default function DebtDisputeModal({ open, customer, debt, staffName, onClose, onNotice, onSaved }: DebtDisputeModalProps) {
  const [rows, setRows] = useState<DebtDisputeRecord[]>([]);
  const [amount, setAmount] = useState(debt?.outstandingAmount || 0);
  const [reason, setReason] = useState('');
  const [assignedTo, setAssignedTo] = useState('Accountant');

  const load = () => setRows(customer ? getDebtDisputes({ customerId: customer.customerId }) : []);

  useEffect(() => {
    if (open) {
      setAmount(debt?.outstandingAmount || 0);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer?.customerId, debt?.debtId]);

  if (!open || !customer) return null;

  const create = async () => {
    await createDebtDispute({
      customerId: customer.customerId,
      customerName: customer.customerName,
      debtId: debt?.debtId || 'STATEMENT',
      debtReference: debt?.receiptNumber || 'Statement dispute',
      disputedAmount: amount,
      reason: reason || 'Customer requested reconciliation.',
      openedBy: staffName,
      assignedTo
    });
    onNotice('Debt dispute opened locally.');
    load();
    onSaved();
  };

  const update = async (row: DebtDisputeRecord, status: DebtDisputeStatus) => {
    if (status === 'Resolved') await resolveDebtDispute(row.disputeId, reason || 'Resolved locally.', staffName);
    else await updateDebtDisputeStatus(row.disputeId, status, reason || `${status} locally.`);
    onNotice(`Dispute marked ${status}.`);
    load();
    onSaved();
  };

  return (
    <div className="pos-modal-backdrop" role="presentation">
      <section className="pos-credit-workflow-modal" role="dialog" aria-modal="true" aria-labelledby="dispute-title">
        <div className="pos-new-customer-modal__header">
          <div><p className="sci-pos-eyebrow">Debt Dispute</p><h2 id="dispute-title">{customer.customerName}</h2></div>
          <button type="button" className="sci-pos-icon-button" onClick={onClose} aria-label="Close dispute modal">X</button>
        </div>
        <div className="pos-credit-config-grid">
          <label>Debt Reference<input value={debt?.receiptNumber || 'Statement dispute'} readOnly /></label>
          <label>Disputed Amount<input type="number" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label>
          <label>Assigned To<input value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} /></label>
          <label className="pos-credit-config-grid__wide">Reason / Notes<textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        </div>
        <div className="collection-diary-table-scroll">
          <table className="sci-pos-table collection-diary-table">
            <thead><tr><th>Reference</th><th>Amount</th><th>Status</th><th>Assigned</th><th>Action</th></tr></thead>
            <tbody>
              {rows.map((row) => <tr key={row.disputeId}><td>{row.debtReference}</td><td>USD {row.disputedAmount.toFixed(2)}</td><td>{row.status}</td><td>{row.assignedTo || 'None'}</td><td><button type="button" onClick={() => void update(row, 'UnderReview')}>Review</button><button type="button" onClick={() => void update(row, 'Resolved')}>Resolve</button><button type="button" onClick={() => void update(row, 'Escalated')}>Escalate</button></td></tr>)}
              {rows.length === 0 && <tr><td colSpan={5}>No disputes captured.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="pos-new-customer-modal__actions">
          <button type="button" className="pos-action-button pos-action-button-primary" onClick={create}>Create Dispute</button>
        </div>
      </section>
    </div>
  );
}
