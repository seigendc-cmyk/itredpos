import type { JournalEntryRecord } from '../types/posTypes';
import { getVendorDocumentIdentity } from '../vendor/vendorBootstrapModel';

export default function JournalEntryPrintDocument({ journal, businessName }: { journal: JournalEntryRecord; businessName: string }) {
  const identity = getVendorDocumentIdentity();
  const documentBusinessName = identity.displayName || businessName;
  return (
    <div className="check-print-document">
      <header>
        <strong>{documentBusinessName}</strong>
        <span>Journal Entry Readiness Preview</span>
      </header>
      <div className="check-print-grid">
        <div><span>Journal No.</span><strong>{journal.journalNumber}</strong></div>
        <div><span>Date</span><strong>{journal.journalDate}</strong></div>
        <div><span>Type</span><strong>{journal.journalType}</strong></div>
        <div><span>Status</span><strong>{journal.status}</strong></div>
      </div>
      <p>{journal.description}</p>
      <table className="sci-pos-table">
        <thead><tr><th>Account</th><th>Description</th><th>Debit</th><th>Credit</th></tr></thead>
        <tbody>
          {journal.lines.map((line) => (
            <tr key={line.lineId}><td>{line.accountCode} - {line.accountName}</td><td>{line.description}</td><td>{line.debit.toFixed(2)}</td><td>{line.credit.toFixed(2)}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="check-print-grid">
        <div><span>Total Debits</span><strong>{journal.totalDebit.toFixed(2)}</strong></div>
        <div><span>Total Credits</span><strong>{journal.totalCredit.toFixed(2)}</strong></div>
        <div><span>Difference</span><strong>{journal.difference.toFixed(2)}</strong></div>
        <div><span>Balanced</span><strong>{journal.balanced ? 'Yes' : 'No'}</strong></div>
      </div>
      <footer>
        <span>Prepared by: {journal.preparedBy}</span>
        <span>Reviewed by: __________________</span>
        <span>Signature: __________________</span>
      </footer>
      <small>Accounting readiness preview only. Not final posted accounts.</small>
    </div>
  );
}
