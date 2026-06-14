import { useEffect, useMemo, useState } from 'react';
import type { CustomerCreditApplication, CustomerRecord } from '../types';
import {
  approveCreditApplication,
  createCreditApplication,
  getCreditApplications,
  markCreditReviewDue,
  rejectCreditApplication,
  submitCreditApplication
} from '../services/customerCreditService';

interface CustomerCreditApplicationModalProps {
  open: boolean;
  customer: CustomerRecord | null;
  staffName: string;
  canApprove: boolean;
  onClose: () => void;
  onNotice: (message: string) => void;
  onSaved: () => void;
}

export default function CustomerCreditApplicationModal({ open, customer, staffName, canApprove, onClose, onNotice, onSaved }: CustomerCreditApplicationModalProps) {
  const [rows, setRows] = useState<CustomerCreditApplication[]>([]);
  const [requestedCreditLimit, setRequestedCreditLimit] = useState(500);
  const [requestedPaymentTermsDays, setRequestedPaymentTermsDays] = useState(30);
  const [reasonForCreditRequest, setReasonForCreditRequest] = useState('');
  const [supportingNotes, setSupportingNotes] = useState('');
  const [guarantorName, setGuarantorName] = useState('');
  const [guarantorPhone, setGuarantorPhone] = useState('');
  const [reviewDate, setReviewDate] = useState(new Date().toISOString().slice(0, 10));
  const latest = useMemo(() => rows[0] || null, [rows]);

  const load = () => setRows(customer ? getCreditApplications({ customerId: customer.customerId }) : []);

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer?.customerId]);

  if (!open || !customer) return null;

  const save = async () => {
    const application = await createCreditApplication({
      customerId: customer.customerId,
      customerName: customer.customerName,
      requestedCreditLimit,
      requestedPaymentTermsDays,
      reasonForCreditRequest: reasonForCreditRequest || 'Customer requested account trading.',
      supportingNotes,
      guarantorName: guarantorName || undefined,
      guarantorPhone: guarantorPhone || undefined,
      contactPersonName: customer.customerName,
      contactPersonPhone: customer.phone || customer.whatsapp,
      reviewDate,
      createdBy: staffName
    });
    await submitCreditApplication(application.applicationId);
    onNotice('Credit application created and submitted locally.');
    load();
    onSaved();
  };

  const approve = async () => {
    if (!latest) return;
    await approveCreditApplication(latest.applicationId, { approvedCreditLimit: requestedCreditLimit, approvedPaymentTermsDays: requestedPaymentTermsDays, approvedBy: staffName, approvalNotes: supportingNotes });
    onNotice('Credit application approved locally and customer credit profile updated.');
    load();
    onSaved();
  };

  const reject = async () => {
    if (!latest) return;
    await rejectCreditApplication(latest.applicationId, supportingNotes || 'Rejected during local review.', staffName);
    onNotice('Credit application rejected locally.');
    load();
    onSaved();
  };

  const markReview = async () => {
    await markCreditReviewDue(customer.customerId, reviewDate);
    onNotice('Credit review due item created locally.');
    onSaved();
  };

  return (
    <div className="pos-modal-backdrop" role="presentation">
      <section className="pos-credit-workflow-modal" role="dialog" aria-modal="true" aria-labelledby="credit-application-title">
        <div className="pos-new-customer-modal__header">
          <div><p className="sci-pos-eyebrow">Credit Application</p><h2 id="credit-application-title">{customer.customerName}</h2></div>
          <button type="button" className="sci-pos-icon-button" onClick={onClose} aria-label="Close credit application">X</button>
        </div>
        <div className="pos-credit-config-grid">
          <label>Requested Credit Limit<input type="number" value={requestedCreditLimit} onChange={(event) => setRequestedCreditLimit(Number(event.target.value))} /></label>
          <label>Requested Payment Terms<input type="number" value={requestedPaymentTermsDays} onChange={(event) => setRequestedPaymentTermsDays(Number(event.target.value))} /></label>
          <label>Review Date<input type="date" value={reviewDate} onChange={(event) => setReviewDate(event.target.value)} /></label>
          <label>Guarantor Name<input value={guarantorName} onChange={(event) => setGuarantorName(event.target.value)} /></label>
          <label>Guarantor Phone<input value={guarantorPhone} onChange={(event) => setGuarantorPhone(event.target.value)} /></label>
          <label className="pos-credit-config-grid__wide">Reason<textarea rows={3} value={reasonForCreditRequest} onChange={(event) => setReasonForCreditRequest(event.target.value)} /></label>
          <label className="pos-credit-config-grid__wide">Supporting / Approval Notes<textarea rows={3} value={supportingNotes} onChange={(event) => setSupportingNotes(event.target.value)} /></label>
        </div>
        <div className="collection-diary-table-scroll">
          <table className="sci-pos-table collection-diary-table">
            <thead><tr><th>Status</th><th>Requested</th><th>Approved</th><th>Review</th><th>Notes</th></tr></thead>
            <tbody>
              {rows.map((row) => <tr key={row.applicationId}><td>{row.status}</td><td>USD {row.requestedCreditLimit.toFixed(2)}</td><td>USD {row.approvedCreditLimit.toFixed(2)}</td><td>{row.reviewDate || 'None'}</td><td>{row.supportingNotes}</td></tr>)}
              {rows.length === 0 && <tr><td colSpan={5}>No credit applications yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="pos-new-customer-modal__actions">
          <button type="button" className="pos-action-button pos-action-button-secondary" onClick={markReview}>Mark Review Due</button>
          <button type="button" className="pos-action-button pos-action-button-secondary" disabled={!latest || !canApprove} onClick={reject}>Reject</button>
          <button type="button" className="pos-action-button pos-action-button-secondary" disabled={!latest || !canApprove} onClick={approve}>Approve</button>
          <button type="button" className="pos-action-button pos-action-button-primary" onClick={save}>New Credit Application</button>
        </div>
      </section>
    </div>
  );
}
