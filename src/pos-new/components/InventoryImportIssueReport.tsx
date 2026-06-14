import type { InventoryImportValidationIssue } from '../types/posTypes';

export default function InventoryImportIssueReport({
  issues,
  onCreateTask,
  onCreateBIWarning
}: {
  issues: InventoryImportValidationIssue[];
  onCreateTask: (issue: InventoryImportValidationIssue) => void;
  onCreateBIWarning: (issue: InventoryImportValidationIssue) => void;
}) {
  const exportCsv = () => {
    const csv = [
      'Severity,Row,Field,Code,Message,Recommended Action',
      ...issues.map((issue) => [issue.severity, issue.rowNumber || '', issue.fieldKey || '', issue.code, issue.message, issue.recommendedAction].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'inventory-import-issues.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const print = () => {
    const popup = window.open('', '_blank', 'width=920,height=720');
    if (!popup) return;
    const rows = issues.map((issue) => `<tr><td>${issue.severity}</td><td>${issue.rowNumber || '-'}</td><td>${issue.fieldKey || '-'}</td><td>${issue.code}</td><td>${issue.message}</td><td>${issue.recommendedAction}</td></tr>`).join('');
    popup.document.write(`<html><head><title>Inventory Import Issues</title><style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #b1b5c2;padding:8px;text-align:left}th{background:#1e222b;color:white}</style></head><body><h1>Inventory Import Issue Report</h1><table><thead><tr><th>Severity</th><th>Row</th><th>Field</th><th>Code</th><th>Message</th><th>Recommended Action</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    popup.document.close();
    popup.print();
  };

  return (
    <section className="sci-pos-card">
      <div className="sci-pos-card__bar">
        <div><p className="sci-pos-eyebrow">Validation</p><h2>Issue Report</h2></div>
        <div className="pos-approval-actions">
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={exportCsv}>Export Issues CSV</button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={print}>Print Issue Report</button>
        </div>
      </div>
      <div className="sci-pos-table-wrap">
        <table className="sci-pos-table">
          <thead><tr><th>Severity</th><th>Row</th><th>Field</th><th>Code</th><th>Message</th><th>Recommended Action</th><th>Action</th></tr></thead>
          <tbody>
            {issues.map((issue) => (
              <tr key={issue.issueId}>
                <td>{issue.severity}</td><td>{issue.rowNumber || '-'}</td><td>{issue.fieldKey || '-'}</td><td>{issue.code}</td><td>{issue.message}</td><td>{issue.recommendedAction}</td>
                <td className="pos-approval-actions"><button className="sci-pos-button sci-pos-button--secondary" onClick={() => onCreateTask(issue)}>Create Task</button><button className="sci-pos-button sci-pos-button--secondary" onClick={() => onCreateBIWarning(issue)}>Create BI Warning</button></td>
              </tr>
            ))}
            {issues.length === 0 && <tr><td colSpan={7} className="sci-pos-empty-cell">No validation issues.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
