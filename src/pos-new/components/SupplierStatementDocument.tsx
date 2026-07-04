import type { SupplierStatementRecord } from '../types';
import { getVendorDocumentIdentity } from '../vendor/vendorBootstrapModel';

const money = (value: number) => `$${value.toFixed(2)}`;

export default function SupplierStatementDocument({ statement }: { statement: SupplierStatementRecord }) {
  const identity = getVendorDocumentIdentity();
  const billTotal = statement.bills.reduce((sum, bill) => sum + bill.originalAmount, 0);
  const paymentTotal = statement.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const returnTotal = statement.supplierReturns.reduce((sum, item) => sum + item.amount, 0);
  const creditNoteTotal = statement.creditNotes.reduce((sum, item) => sum + item.amount, 0);
  const overdue = statement.bills.filter((bill) => bill.overdueDays > 0).reduce((sum, bill) => sum + bill.outstandingAmount, 0);
  const ageing = {
    current: statement.bills.filter((bill) => bill.ageingBucket === 'Current').reduce((sum, bill) => sum + bill.outstandingAmount, 0),
    days1To30: statement.bills.filter((bill) => bill.ageingBucket === 'Days1To30').reduce((sum, bill) => sum + bill.outstandingAmount, 0),
    days31To60: statement.bills.filter((bill) => bill.ageingBucket === 'Days31To60').reduce((sum, bill) => sum + bill.outstandingAmount, 0),
    days61To90: statement.bills.filter((bill) => bill.ageingBucket === 'Days61To90').reduce((sum, bill) => sum + bill.outstandingAmount, 0),
    days91To120: statement.bills.filter((bill) => bill.ageingBucket === 'Days91To120').reduce((sum, bill) => sum + bill.outstandingAmount, 0),
    days120Plus: statement.bills.filter((bill) => bill.ageingBucket === 'Days120Plus').reduce((sum, bill) => sum + bill.outstandingAmount, 0)
  };
  return (
    <article className="supplier-statement-document print-document">
      <header className="report-print-document__header">
        <div><span>Business / Vendor</span><strong>{identity.displayName}</strong><small>{[identity.addressLine, identity.cityLine, identity.phoneLine, identity.emailLine].filter(Boolean).join(' | ')}</small></div>
        <div><span>Supplier</span><strong>{statement.supplierName}</strong><small>Supplier ID {statement.supplierId} - Contact on supplier profile</small></div>
        <div><span>Statement</span><strong>{statement.statementId}</strong><small>{statement.periodFrom} to {statement.periodTo}</small></div>
      </header>
      <section className="creditors-summary-grid">
        <div className="creditors-summary-card"><span>Opening Balance</span><strong>{money(statement.openingBalance)}</strong></div>
        <div className="creditors-summary-card"><span>Supplier Bills</span><strong>{money(billTotal)}</strong></div>
        <div className="creditors-summary-card"><span>Payments</span><strong>{money(paymentTotal)}</strong></div>
        <div className="creditors-summary-card"><span>Returns</span><strong>{money(returnTotal)}</strong></div>
        <div className="creditors-summary-card"><span>Credit Notes</span><strong>{money(creditNoteTotal)}</strong></div>
        <div className="creditors-summary-card"><span>Closing Balance</span><strong>{money(statement.closingBalance)}</strong></div>
        <div className="creditors-summary-card"><span>Overdue Balance</span><strong>{money(overdue)}</strong></div>
      </section>
      <section className="report-print-document__summary">
        <div><span>Current</span><strong>{money(ageing.current)}</strong></div>
        <div><span>1-30 Days</span><strong>{money(ageing.days1To30)}</strong></div>
        <div><span>31-60 Days</span><strong>{money(ageing.days31To60)}</strong></div>
        <div><span>61-90 Days</span><strong>{money(ageing.days61To90)}</strong></div>
        <div><span>91-120 Days</span><strong>{money(ageing.days91To120)}</strong></div>
        <div><span>120+ Days</span><strong>{money(ageing.days120Plus)}</strong></div>
      </section>
      <table className="creditors-table"><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead><tbody>{statement.bills.map((bill) => <tr key={bill.billId}><td>{bill.billDate}</td><td>Supplier Bill</td><td>{bill.billNumber}</td><td>{money(bill.originalAmount)}</td><td>{money(bill.paidAmount)}</td><td>{money(bill.outstandingAmount)}</td></tr>)}{statement.payments.map((payment) => <tr key={payment.paymentId}><td>{payment.paymentDate}</td><td>Payment</td><td>{payment.paymentNumber}</td><td>{money(0)}</td><td>{money(payment.amount)}</td><td>-</td></tr>)}{statement.supplierReturns.map((item) => <tr key={item.reference}><td>{item.date}</td><td>Supplier Return</td><td>{item.reference}</td><td>{money(0)}</td><td>{money(item.amount)}</td><td>{item.notes}</td></tr>)}{statement.creditNotes.map((item) => <tr key={item.reference}><td>{item.date}</td><td>Credit Note</td><td>{item.reference}</td><td>{money(0)}</td><td>{money(item.amount)}</td><td>{item.notes}</td></tr>)}</tbody></table>
      <footer className="report-print-document__footer">
        <div><span>Payment Instruction</span><p>Confirm bank details directly with supplier before payment.</p></div>
        <div><span>Generated</span><strong>{new Date(statement.generatedAt).toLocaleString()}</strong><p>Prepared by {statement.generatedBy}</p></div>
        <div><span>Signature / Review</span><strong>____________________________</strong></div>
      </footer>
    </article>
  );
}
