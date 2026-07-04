import { getVendorDocumentIdentity } from '../vendor/vendorBootstrapModel';

export interface ReportColumn {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
}

export interface ReportMetric {
  label: string;
  value: string;
}

export interface ReportPrintDocumentProps {
  title: string;
  reportNumber: string;
  periodLabel: string;
  generatedBy: string;
  generatedAt: string;
  summary: ReportMetric[];
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
  notes?: string[];
}

export default function ReportPrintDocument({ title, reportNumber, periodLabel, generatedBy, generatedAt, summary, columns, rows, notes = [] }: ReportPrintDocumentProps) {
  const identity = getVendorDocumentIdentity();
  const contactLine = [identity.phoneLine, identity.whatsappLine, identity.emailLine].filter(Boolean).join(' | ');
  return (
    <article className="print-document report-print-document">
      <header className="report-print-document__header">
        <div>
          <span>Business</span>
          <strong>{identity.displayName}</strong>
          <small>{[identity.addressLine, identity.cityLine, contactLine].filter(Boolean).join(' | ')}</small>
        </div>
        <div>
          <span>Report</span>
          <strong>{title}</strong>
          <small>{reportNumber}</small>
        </div>
        <div>
          <span>Period</span>
          <strong>{periodLabel}</strong>
          <small>Generated {new Date(generatedAt).toLocaleString()} by {generatedBy}</small>
        </div>
      </header>

      <section className="report-print-document__summary">
        {summary.map((metric) => (
          <div key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </section>

      <div className="report-print-document__table-scroll">
        <table className="report-print-document__table">
          <thead>
            <tr>{columns.map((column) => <th key={column.key} style={{ textAlign: column.align || 'left' }}>{column.header}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length}>No rows found for this report.</td></tr>
            ) : rows.map((row, index) => (
              <tr key={`${reportNumber}-${index}`}>
                {columns.map((column) => <td key={column.key} style={{ textAlign: column.align || 'left' }}>{row[column.key] ?? ''}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="report-print-document__footer">
        <div>
          <span>Review Notes</span>
          {notes.length ? notes.map((note) => <p key={note}>{note}</p>) : <p>Reviewed as a management-control output before accounting readiness consolidation.</p>}
        </div>
        <div>
          <span>Prepared By</span>
          <strong>{generatedBy}</strong>
        </div>
        <div>
          <span>Signature / Review</span>
          <strong>____________________________</strong>
        </div>
      </footer>
    </article>
  );
}
