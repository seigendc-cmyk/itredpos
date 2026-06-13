import type { ShiftEodPrintPayload } from '../services/shiftEodReportService';

interface ShiftEodReportDocumentProps {
  payload: ShiftEodPrintPayload;
}

type ReportRow = {
  label: string;
  value: string | number;
};

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

function numberValue(value: number): string {
  return String(value);
}

function dateTime(value?: string): string {
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function durationBetween(start: string, end: string): string {
  const started = new Date(start).getTime();
  const ended = new Date(end).getTime();
  if (Number.isNaN(started) || Number.isNaN(ended) || ended < started) return 'Not recorded';
  const minutes = Math.round((ended - started) / 60000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function varianceStatus(value: number): string {
  if (value === 0) return 'Balanced';
  return value > 0 ? 'Over declared cash' : 'Cash short';
}

function ReportTable({ title, rows }: { title: string; rows: ReportRow[] }) {
  return (
    <section className="shift-eod-report-section">
      <h2>{title}</h2>
      <table className="shift-eod-report-table">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function SignatureRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="shift-eod-signature-row">
      <span>{label}</span>
      <strong>{value || '______________________'}</strong>
      <em>Date: ___________</em>
    </div>
  );
}

export default function ShiftEodReportDocument({ payload }: ShiftEodReportDocumentProps) {
  const shiftDetails: ReportRow[] = [
    { label: 'Shift ID', value: payload.summary.shiftId },
    { label: 'Terminal', value: payload.summary.terminal },
    { label: 'Terminal ID', value: payload.terminalId },
    { label: 'Branch', value: payload.summary.branch },
    { label: 'Branch ID', value: payload.branchId },
    { label: 'Staff', value: payload.summary.staff },
    { label: 'Staff ID', value: payload.staffId },
    { label: 'Role', value: payload.roleName },
    { label: 'Opened At', value: dateTime(payload.summary.openedAt) },
    { label: 'Closed At', value: dateTime(payload.summary.closedAt) },
    { label: 'Duration', value: durationBetween(payload.summary.openedAt, payload.summary.closedAt) },
    { label: 'Drawer', value: payload.drawer.drawerId }
  ];

  const salesSummary: ReportRow[] = [
    { label: 'Completed Sales', value: numberValue(payload.sales.completedSales) },
    { label: 'Gross Sales', value: money(payload.sales.grossSales) },
    { label: 'Returns', value: money(payload.sales.returns) },
    { label: 'Discounts', value: money(payload.sales.discounts) },
    { label: 'Net Sales', value: money(payload.sales.netSales) },
    { label: 'Sales Count', value: numberValue(payload.summary.salesCount) },
    { label: 'Held Sales', value: numberValue(payload.activity.heldSales) },
    { label: 'Voided Carts', value: numberValue(payload.activity.voidedCarts) }
  ];

  const vatSummary: ReportRow[] = [
    { label: 'VAT Inclusive Sales', value: money(payload.vat.vatInclusiveSales) },
    { label: 'VAT Exclusive Sales', value: money(payload.vat.vatExclusiveSales) },
    { label: 'VAT Exempt Sales', value: money(payload.vat.vatExemptSales) },
    { label: 'Taxable Amount', value: money(payload.vat.taxableAmount) },
    { label: 'VAT Amount', value: money(payload.vat.vatAmount) },
    { label: 'VAT Rate', value: payload.vat.rateBreakdown.map((rate) => rate.rate).join(', ') || 'Local VAT' }
  ];

  const paymentSummary: ReportRow[] = [
    { label: 'Cash', value: money(payload.payments.cash) },
    { label: 'EcoCash Placeholder', value: money(payload.payments.ecocashPlaceholder) },
    { label: 'Innbucks Placeholder', value: money(payload.payments.innbucksPlaceholder) },
    { label: 'Mukuru Placeholder', value: money(payload.payments.mukuruPlaceholder) },
    { label: 'ZIPIT Placeholder', value: money(payload.payments.zipitPlaceholder) },
    { label: 'Bank Transfer', value: money(payload.payments.bankTransfer) },
    { label: 'Card Placeholder', value: money(payload.payments.cardPlaceholder) },
    { label: 'Account / Credit', value: money(payload.payments.accountCredit) },
    { label: 'Mixed Payment', value: money(payload.payments.mixedPayment) },
    { label: 'Already Paid', value: money(payload.payments.alreadyPaid) }
  ];

  const drawerSummary: ReportRow[] = [
    { label: 'Opening Float', value: money(payload.drawer.openingFloat) },
    { label: 'Expected Cash', value: money(payload.drawer.expectedCash) },
    { label: 'Counted Cash', value: money(payload.drawer.countedCash) },
    { label: 'Cash Sales', value: money(payload.drawer.cashSales) },
    { label: 'Cash Refunds', value: money(payload.cashVariance.cashRefunds) },
    { label: 'Drawer Opens', value: numberValue(payload.cashVariance.drawerOpens) },
    { label: 'Variance', value: money(payload.drawer.variance) },
    { label: 'Variance Status', value: varianceStatus(payload.drawer.variance) }
  ];

  const cashVarianceSummary: ReportRow[] = [
    { label: 'Expected Cash', value: money(payload.cashVariance.expectedCash) },
    { label: 'Counted Cash', value: money(payload.cashVariance.countedCash) },
    { label: 'Variance', value: money(payload.cashVariance.variance) },
    { label: 'Cash Sales', value: money(payload.cashVariance.cashSales) },
    { label: 'Cash Refunds', value: money(payload.cashVariance.cashRefunds) },
    { label: 'Drawer Opens', value: numberValue(payload.cashVariance.drawerOpens) },
    { label: 'Reviewed By', value: payload.cashVariance.reviewedBy },
    { label: 'Notes', value: payload.cashVariance.notes }
  ];

  const activitySummary: ReportRow[] = [
    { label: 'Sales Completed', value: numberValue(payload.activity.salesCompleted) },
    { label: 'Held Sales', value: numberValue(payload.activity.heldSales) },
    { label: 'Voided Carts', value: numberValue(payload.activity.voidedCarts) },
    { label: 'Discounts Applied', value: numberValue(payload.activity.discounts) },
    { label: 'Receipts Reprinted', value: '0' },
    { label: 'Delivery Requests', value: numberValue(payload.activity.deliveryEvents) },
    { label: 'BI Events', value: numberValue(payload.activity.events.filter((event) => event.eventType.toLowerCase().includes('bi')).length) },
    { label: 'Cash Logs', value: numberValue(payload.activity.cashDrawerEvents) }
  ];

  return (
    <article id="shift-eod-print-area" className="shift-eod-report-print-root" aria-label="Shift end of day printable report">
      <div className="shift-eod-report-document">
        <header className="shift-eod-report-document__header">
          <div>
            <p className="shift-eod-report-brand">{payload.businessName}</p>
            <h1>SHIFT END OF DAY REPORT</h1>
            <p>Terminal, shift, sales, VAT, drawer, payment, and cash variance summary.</p>
          </div>
          <div className="shift-eod-report-meta">
            <span>Report Number: {payload.reportNumber}</span>
            <span>Generated At: {dateTime(payload.generatedAt)}</span>
            <span>Generated By: {payload.generatedBy}</span>
            <span>Report Status: {payload.reportStatus}</span>
            <span>Source: {payload.source}</span>
          </div>
        </header>

        <div className="shift-eod-report-summary-line">
          <span>Vendor: {payload.businessName}</span>
          <span>Branch: {payload.summary.branch}</span>
          <span>Terminal: {payload.summary.terminal}</span>
          <span>Staff: {payload.summary.staff}</span>
        </div>

        <ReportTable title="1. Shift Details" rows={shiftDetails} />
        <ReportTable title="2. Sales Summary" rows={salesSummary} />
        <ReportTable title="3. VAT Summary" rows={vatSummary} />
        <ReportTable title="4. Payment Summary" rows={paymentSummary} />
        <ReportTable title="5. Cash Drawer Reconciliation" rows={drawerSummary} />
        <ReportTable title="6. Cash Variance Summary" rows={cashVarianceSummary} />
        <ReportTable title="7. Shift Activity Summary" rows={activitySummary} />

        <section className="shift-eod-report-section">
          <h2>8. Exceptions / Warnings</h2>
          <ul className="shift-eod-exception-list">
            {payload.exceptions.map((exception) => <li key={exception}>{exception}</li>)}
          </ul>
        </section>

        <section className="shift-eod-report-section shift-eod-signatures">
          <h2>9. Prepared By / Reviewed By / Approved By</h2>
          <SignatureRow label="Prepared By" value={payload.signatures.preparedBy} />
          <SignatureRow label="Reviewed By" value={payload.signatures.reviewedBy} />
          <SignatureRow label="Approved By" value={payload.signatures.approvedBy} />
          <SignatureRow label="Cash Handed Over By" value={payload.signatures.cashHandedOverBy} />
          <SignatureRow label="Cash Received By" value={payload.signatures.cashReceivedBy} />
        </section>

        <footer className="shift-eod-report-footer">
          <span>Generated timestamp: {dateTime(payload.generatedAt)}</span>
          <strong>iTred Commerce POS - Shift EOD Report</strong>
        </footer>
      </div>
    </article>
  );
}
