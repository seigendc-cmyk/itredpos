import type { CheckWriterRecord } from '../types/posTypes';

export default function CheckPrintPreviewDocument({ check, businessName }: { check: CheckWriterRecord; businessName: string }) {
  return (
    <div className="check-print-document">
      <header>
        <strong>{businessName}</strong>
        <span>Check / Payment Voucher Preview</span>
      </header>
      <div className="check-print-grid">
        <div><span>Check No.</span><strong>{check.checkNumber}</strong></div>
        <div><span>Date</span><strong>{check.checkDate}</strong></div>
        <div><span>Payee</span><strong>{check.payeeName}</strong></div>
        <div><span>Amount</span><strong>{check.currency} {check.amount.toFixed(2)}</strong></div>
      </div>
      <div className="check-payline">{check.amountInWords}</div>
      <div className="check-print-grid">
        <div><span>Bank/Cash Account</span><strong>{check.bankAccountName}</strong></div>
        <div><span>Debit Account</span><strong>{check.debitAccountName}</strong></div>
        <div><span>Purpose</span><strong>{check.paymentPurpose}</strong></div>
        <div><span>Status</span><strong>{check.status}</strong></div>
      </div>
      <p>{check.memo}</p>
      <footer>
        <span>Prepared by: {check.createdBy}</span>
        <span>Approved by: __________________</span>
        <span>Signature: __________________</span>
      </footer>
      <small>Financial Control preview only. Not final posted accounts or banking transaction.</small>
    </div>
  );
}
